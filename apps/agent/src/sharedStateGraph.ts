/**
 * A demo of shared state between the agent and CopilotKit using LangGraph.
 */

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { dispatchCustomEvent } from "@langchain/core/callbacks/dispatch";
import { Command, Annotation, MessagesAnnotation, StateGraph, END, START } from "@langchain/langgraph";

enum SkillLevel {
  BEGINNER = "Beginner",
  INTERMEDIATE = "Intermediate",
  ADVANCED = "Advanced"
}

enum SpecialPreferences {
  HIGH_PROTEIN = "High Protein",
  LOW_CARB = "Low Carb",
  SPICY = "Spicy",
  BUDGET_FRIENDLY = "Budget-Friendly",
  ONE_POT_MEAL = "One-Pot Meal",
  VEGETARIAN = "Vegetarian",
  VEGAN = "Vegan"
}

enum CookingTime {
  FIVE_MIN = "5 min",
  FIFTEEN_MIN = "15 min",
  THIRTY_MIN = "30 min",
  FORTY_FIVE_MIN = "45 min",
  SIXTY_PLUS_MIN = "60+ min"
}

interface Ingredient {
  icon: string;
  name: string;
  amount: string;
}

interface Recipe {
  skill_level: SkillLevel;
  special_preferences: SpecialPreferences[];
  cooking_time: CookingTime;
  ingredients: Ingredient[];
  instructions: string[];
  changes?: string;
}

const GENERATE_RECIPE_TOOL = {
  type: "function",
  function: {
    name: "generate_recipe",
    description: "在已有（若有）食材与步骤基础上继续完善食谱，确保完整。必须始终提供完整食谱，而非仅列出改动。",
    parameters: {
      type: "object",
      properties: {
        recipe: {
          type: "object",
          properties: {
            skill_level: {
              type: "string",
              enum: Object.values(SkillLevel),
              description: "食谱所需厨艺水平"
            },
            special_preferences: {
              type: "array",
              items: {
                type: "string",
                enum: Object.values(SpecialPreferences)
              },
              description: "食谱的特殊偏好列表"
            },
            cooking_time: {
              type: "string",
              enum: Object.values(CookingTime),
              description: "烹饪所需时间"
            },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  icon: { type: "string", description: "食材图标 emoji（使用真实 emoji，而非 \\u 转义）" },
                  name: { type: "string" },
                  amount: { type: "string" }
                }
              },
              description: "完整食材列表，含新增与原有食材"
            },
            instructions: {
              type: "array",
              items: { type: "string" },
              description: "完整步骤列表，含新增与原有步骤"
            },
            changes: {
              type: "string",
              description: "对食谱所做改动的说明"
            }
          },
        }
      },
      required: ["recipe"]
    }
  }
};

export const AgentStateAnnotation = Annotation.Root({
  recipe: Annotation<Recipe | undefined>(),
  tools: Annotation<any[]>(),
  ...MessagesAnnotation.spec,
});
export type AgentState = typeof AgentStateAnnotation.State;

async function startFlow(state: AgentState, config?: RunnableConfig): Promise<Command> {
  /**
   * This is the entry point for the flow.
   */

  // Initialize recipe if not exists
  if (!state.recipe) {
    state.recipe = {
      skill_level: SkillLevel.BEGINNER,
      special_preferences: [],
      cooking_time: CookingTime.FIFTEEN_MIN,
      ingredients: [{ icon: "🍴", name: "示例食材", amount: "1 份" }],
      instructions: ["第一步操作说明"]
    };
    // Emit the initial state to ensure it's properly shared with the frontend
    await dispatchCustomEvent("manually_emit_intermediate_state", state, config);
  }
  
  return new Command({
    goto: "chat_node",
    update: {
      messages: state.messages,
      recipe: state.recipe
    }
  });
}

async function chatNode(state: AgentState, config?: RunnableConfig): Promise<Command> {
  /**
   * Standard chat node.
   */
  // Create a safer serialization of the recipe
  let recipeJson = "尚无食谱";
  if (state.recipe) {
    try {
      recipeJson = JSON.stringify(state.recipe, null, 2);
    } catch (e) {
      recipeJson = `序列化食谱时出错：${e}`;
    }
  }

  const systemPrompt = `你是协助用户编写食谱的助手。
    当前食谱状态：${recipeJson}
    可通过调用 generate_recipe 工具来完善食谱。

    重要约定：
    1. 在现有食材与步骤基础上完成食谱，确保内容完整。
    2. 新增食材请追加到原列表之后。
    3. 新增步骤请追加到原步骤之后。
    4. ingredients 必须为对象数组，每项含 icon、name、amount。
    5. instructions 必须为字符串数组。

    若你刚创建或修改了食谱，回复仅用一句话说明你做了什么，不要复述食谱全文。
    `;

  // Define the model
  const model = new ChatOpenAI({
    temperature: 0,
    model: process.env.OPENAI_API_MODEL || 'gpt-4o',
    ...(process.env.OPENAI_API_KEY && { apiKey: process.env.OPENAI_API_KEY }),
    ...(process.env.OPENAI_API_BASE_URL && {
      configuration: { baseURL: process.env.OPENAI_API_BASE_URL },
    }),
  });
  
  // Define config for the model
  if (!config) {
    config = { recursionLimit: 25 };
  }

  // Use "predict_state" metadata to set up streaming for the write_document tool
  if (!config.metadata) config.metadata = {};
  config.metadata.predict_state = [{
    state_key: "recipe",
    tool: "generate_recipe",
    tool_argument: "recipe"
  }];

  // Bind the tools to the model
  const modelWithTools = model.bindTools(
    [
      ...state.tools,
      GENERATE_RECIPE_TOOL
    ],
    {
      // Disable parallel tool calls to avoid race conditions
      parallel_tool_calls: false,
    }
  );

  // Run the model and generate a response
  const response = await modelWithTools.invoke([
    new SystemMessage({ content: systemPrompt }),
    ...state.messages,
  ], config);

  // Update messages with the response
  const messages = [...state.messages, response];
  
  // Handle tool calls
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];
    
    if (toolCall.name === "generate_recipe") {
      // Update recipe state with tool_call_args
      const recipeData = toolCall.args.recipe;
      let recipe: Recipe;
      // If we have an existing recipe, update it
      if (state.recipe) {
        recipe = { ...state.recipe };
        for (const [key, value] of Object.entries(recipeData)) {
          if (value !== null && value !== undefined) {  // Only update fields that were provided
            (recipe as any)[key] = value;
          }
        }
      } else {
        // Create a new recipe
        recipe = {
          skill_level: recipeData.skill_level || SkillLevel.BEGINNER,
          special_preferences: recipeData.special_preferences || [],
          cooking_time: recipeData.cooking_time || CookingTime.FIFTEEN_MIN,
          ingredients: recipeData.ingredients || [],
          instructions: recipeData.instructions || []
        };
      }
      
      // Add tool response to messages
      const toolResponse = {
        role: "tool" as const,
        content: "食谱已生成。",
        tool_call_id: toolCall.id
      };
      
      const updatedMessages = [...messages, toolResponse];
      
      // Explicitly emit the updated state to ensure it's shared with frontend
      state.recipe = recipe;
      await dispatchCustomEvent("manually_emit_intermediate_state", state, config);
      
      // Return command with updated recipe
      return new Command({
        goto: "start_flow",
        update: {
          messages: updatedMessages,
          recipe: recipe
        }
      });
    }
  }

  return new Command({
    goto: END,
    update: {
      messages: messages,
      recipe: state.recipe
    }
  });
}

// Define the graph
const workflow = new StateGraph<AgentState>(AgentStateAnnotation);

// Add nodes
workflow.addNode("start_flow", startFlow);
workflow.addNode("chat_node", chatNode);

// Add edges
workflow.setEntryPoint("start_flow");
workflow.addEdge(START, "start_flow");
workflow.addEdge("start_flow", "chat_node");
workflow.addEdge("chat_node", END);

// Compile the graph
export const sharedStateGraph = workflow.compile();