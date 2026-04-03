/**
 * A travel agent supervisor demo showcasing multi-agent architecture with subgraphs.
 * The supervisor coordinates specialized agents: flights finder, hotels finder, and experiences finder.
 */

import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { 
  Annotation, 
  MessagesAnnotation, 
  StateGraph, 
  Command, 
  START, 
  END, 
  interrupt 
} from "@langchain/langgraph";

// Travel data interfaces
interface Flight {
  airline: string;
  departure: string;
  arrival: string;
  price: string;
  duration: string;
}

interface Hotel {
  name: string;
  location: string;
  price_per_night: string;
  rating: string;
}

interface Experience {
  name: string;
  type: "restaurant" | "activity";
  description: string;
  location: string;
}

interface Itinerary {
  flight?: Flight;
  hotel?: Hotel;
}

// Custom reducer to merge itinerary updates
function mergeItinerary(left: Itinerary | null, right?: Itinerary | null): Itinerary {
  if (!left) left = {};
  if (!right) right = {};
  return { ...left, ...right };
}

// State annotation for travel agent system
export const TravelAgentStateAnnotation = Annotation.Root({
  origin: Annotation<string>(),
  destination: Annotation<string>(),
  flights: Annotation<Flight[] | null>(),
  hotels: Annotation<Hotel[] | null>(),
  experiences: Annotation<Experience[] | null>(),

  // Itinerary with custom merger
  itinerary: Annotation<Itinerary | null>({
    reducer: mergeItinerary,
    default: () => null
  }),

  // Tools available to all agents
  tools: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => []
  }),

  // Supervisor routing
  next_agent: Annotation<string | null>(),
  ...MessagesAnnotation.spec,
});

export type TravelAgentState = typeof TravelAgentStateAnnotation.State;

// Static data for demonstration
const STATIC_FLIGHTS: Flight[] = [
  { airline: "KLM", departure: "Amsterdam (AMS)", arrival: "San Francisco (SFO)", price: "$650", duration: "11h 30m" },
  { airline: "United", departure: "Amsterdam (AMS)", arrival: "San Francisco (SFO)", price: "$720", duration: "12h 15m" }
];

const STATIC_HOTELS: Hotel[] = [
  { name: "Hotel Zephyr", location: "Fisherman's Wharf", price_per_night: "$280/night", rating: "4.2 stars" },
  { name: "The Ritz-Carlton", location: "Nob Hill", price_per_night: "$550/night", rating: "4.8 stars" },
  { name: "Hotel Zoe", location: "Union Square", price_per_night: "$320/night", rating: "4.4 stars" }
];

const STATIC_EXPERIENCES: Experience[] = [
  { name: "Pier 39", type: "activity", description: "标志性海滨景点，有商铺与海狮", location: "渔人码头" },
  { name: "Golden Gate Bridge", type: "activity", description: "世界闻名的悬索桥，视野开阔", location: "金门" },
  { name: "Swan Oyster Depot", type: "restaurant", description: "历史悠久的海鲜吧台，供应新鲜生蚝", location: "波尔克街" },
  { name: "Tartine Bakery", type: "restaurant", description: "以面包与糕点闻名的手工烘焙店", location: "米慎区" }
];

function createInterrupt(message: string, options: any[], recommendation: any, agent: string) {
  return interrupt({
    message,
    options,
    recommendation,
    agent,
  });
}

// Flights finder subgraph
async function flightsFinder(state: TravelAgentState, config?: RunnableConfig): Promise<Command> {
  // Simulate flight search with static data
  const flights = STATIC_FLIGHTS;

  const selectedFlight = state.itinerary?.flight;
  
  let flightChoice: Flight;
  const message = `找到 ${flights.length} 条从 ${state.origin || '阿姆斯特丹'} 飞往 ${state.destination || '旧金山'} 的航班。\n` +
    `建议选择 ${flights[0].airline} 的航班，准点率较好且价格更优。`
  if (!selectedFlight) {
    const interruptResult = createInterrupt(
      message,
      flights,
      flights[0],
      "flights"
    );
    
    // Parse the interrupt result if it's a string
    flightChoice = typeof interruptResult === 'string' ? JSON.parse(interruptResult) : interruptResult;
  } else {
    flightChoice = selectedFlight;
  }

  return new Command({
    goto: END,
    update: {
      flights: flights,
      itinerary: {
        flight: flightChoice
      },
      // Return all "messages" that the agent was sending
      messages: [
        ...state.messages,
        new AIMessage({
          content: message,
        }),
        new AIMessage({
          content: `机票助手：好的。将为您预订 ${flightChoice.airline} 从 ${flightChoice.departure} 飞往 ${flightChoice.arrival} 的航班。`,
        }),
      ]
    }
  });
}

// Hotels finder subgraph
async function hotelsFinder(state: TravelAgentState, config?: RunnableConfig): Promise<Command> {
  // Simulate hotel search with static data
  const hotels = STATIC_HOTELS;
  const selectedHotel = state.itinerary?.hotel;
  
  let hotelChoice: Hotel;
  const message = `在 ${state.destination || '旧金山'} 找到 ${hotels.length} 家住宿。\n` +
    `建议选择 ${hotels[2].name}，在评分、价格与位置之间较为均衡。`
  if (!selectedHotel) {
    const interruptResult = createInterrupt(
      message,
      hotels,
      hotels[2],
      "hotels"
    );
    
    // Parse the interrupt result if it's a string
    hotelChoice = typeof interruptResult === 'string' ? JSON.parse(interruptResult) : interruptResult;
  } else {
    hotelChoice = selectedHotel;
  }

  return new Command({
    goto: END,
    update: {
      hotels: hotels,
      itinerary: {
        hotel: hotelChoice
      },
      // Return all "messages" that the agent was sending
      messages: [
        ...state.messages,
        new AIMessage({
          content: message,
        }),
        new AIMessage({
          content: `酒店助手：选得不错！您会喜欢 ${hotelChoice.name} 的。`
        }),
      ]
    }
  });
}

// Experiences finder subgraph
async function experiencesFinder(state: TravelAgentState, config?: RunnableConfig): Promise<Command> {
  // Filter experiences (2 restaurants, 2 activities)
  const restaurants = STATIC_EXPERIENCES.filter(exp => exp.type === "restaurant").slice(0, 2);
  const activities = STATIC_EXPERIENCES.filter(exp => exp.type === "activity").slice(0, 2);
  const experiences = [...restaurants, ...activities];

  const model = new ChatOpenAI({
    temperature: 0,
    model: process.env.OPENAI_API_MODEL || 'gpt-4o',
    ...(process.env.OPENAI_API_KEY && { apiKey: process.env.OPENAI_API_KEY }),
    ...(process.env.OPENAI_API_BASE_URL && {
      configuration: { baseURL: process.env.OPENAI_API_BASE_URL },
    }),
  });

  if (!config) {
    config = { recursionLimit: 25 };
  }

  const itinerary = state.itinerary || {};

  const systemPrompt = `
    你是「体验」助手，负责为用户推荐餐厅与活动。
    你已经检索到一批体验项目，现在只需向用户说明你的发现即可。

    当前状态：
    - 出发地：${state.origin || '阿姆斯特丹'}
    - 目的地：${state.destination || '旧金山'}
    - 已选航班：${JSON.stringify(itinerary.flight) || '无'}
    - 已选酒店：${JSON.stringify(itinerary.hotel) || '无'}
    - 已找到的活动：${JSON.stringify(activities)}
    - 已找到的餐厅：${JSON.stringify(restaurants)}
    `;

  // Get experiences response
  const response = await model.invoke([
    new SystemMessage({ content: systemPrompt }),
    ...state.messages,
  ], config);

  return new Command({
    goto: END,
    update: {
      experiences: experiences,
      messages: [...state.messages, response]
    }
  });
}

// Supervisor response tool
const SUPERVISOR_RESPONSE_TOOL = {
  type: "function" as const,
  function: {
    name: "supervisor_response",
    description: "请始终使用本工具结构化你对用户的回复。",
    parameters: {
      type: "object",
      properties: {
        answer: {
          type: "string",
          description: "给用户的回答内容"
        },
        next_agent: {
          type: "string",
          enum: ["flights_agent", "hotels_agent", "experiences_agent", "complete"],
          description: "下一步要转交的助手；若无需再转交其他助手则可省略。"
        }
      },
      required: ["answer"]
    }
  }
};

// Supervisor agent
async function supervisorAgent(state: TravelAgentState, config?: RunnableConfig): Promise<Command> {
  const itinerary = state.itinerary || {};

  // Check what's already completed
  const hasFlights = itinerary.flight !== undefined;
  const hasHotels = itinerary.hotel !== undefined;
  const hasExperiences = state.experiences !== null;

  const systemPrompt = `
    你是旅行规划协调员，负责调度各专职助手帮用户规划行程。

    当前状态：
    - 出发地：${state.origin || '阿姆斯特丹'}
    - 目的地：${state.destination || '旧金山'}
    - 是否已有航班：${hasFlights}
    - 是否已有酒店：${hasHotels}
    - 是否已有体验推荐：${hasExperiences}
    - 行程单（用户已确认的选项）：${JSON.stringify(itinerary, null, 2)}

    可用助手：
    - flights_agent：查找航班
    - hotels_agent：查找酒店
    - experiences_agent：推荐餐厅与活动
    - complete：全部信息齐备时结束任务

    请根据尚缺环节路由到对应助手；各助手都完成后请路由到 complete。
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

  if (!config) {
    config = { recursionLimit: 25 };
  }

  // Bind the routing tool
  const modelWithTools = model.bindTools(
    [SUPERVISOR_RESPONSE_TOOL],
    {
      parallel_tool_calls: false,
    }
  );

  // Get supervisor decision
  const response = await modelWithTools.invoke([
    new SystemMessage({ content: systemPrompt }),
    ...state.messages,
  ], config);

  let messages = [...state.messages, response];

  // Handle tool calls for routing
  if (response.tool_calls && response.tool_calls.length > 0) {
    const toolCall = response.tool_calls[0];
    const toolCallArgs = toolCall.args;
    const nextAgent = toolCallArgs.next_agent;

    const toolResponse = new ToolMessage({
      tool_call_id: toolCall.id!,
      content: `正在转交至 ${nextAgent} 并附带上述回复`,
    });

    messages = [
      ...messages, 
      toolResponse, 
      new AIMessage({ content: toolCallArgs.answer })
    ];

    if (nextAgent && nextAgent !== "complete") {
      return new Command({ goto: nextAgent });
    }
  }

  // Fallback if no tool call or complete
  return new Command({
    goto: END,
    update: { messages }
  });
}

// Create subgraphs
const flightsGraph = new StateGraph(TravelAgentStateAnnotation);
flightsGraph.addNode("flights_agent_chat_node", flightsFinder);
flightsGraph.setEntryPoint("flights_agent_chat_node");
flightsGraph.addEdge(START, "flights_agent_chat_node");
flightsGraph.addEdge("flights_agent_chat_node", END);
const flightsSubgraph = flightsGraph.compile();

const hotelsGraph = new StateGraph(TravelAgentStateAnnotation);
hotelsGraph.addNode("hotels_agent_chat_node", hotelsFinder);
hotelsGraph.setEntryPoint("hotels_agent_chat_node");
hotelsGraph.addEdge(START, "hotels_agent_chat_node");
hotelsGraph.addEdge("hotels_agent_chat_node", END);
const hotelsSubgraph = hotelsGraph.compile();

const experiencesGraph = new StateGraph(TravelAgentStateAnnotation);
experiencesGraph.addNode("experiences_agent_chat_node", experiencesFinder);
experiencesGraph.setEntryPoint("experiences_agent_chat_node");
experiencesGraph.addEdge(START, "experiences_agent_chat_node");
experiencesGraph.addEdge("experiences_agent_chat_node", END);
const experiencesSubgraph = experiencesGraph.compile();

// Main supervisor workflow
const workflow = new StateGraph(TravelAgentStateAnnotation);

// Add supervisor and subgraphs as nodes
workflow.addNode("supervisor", supervisorAgent, { ends: ['flights_agent', 'hotels_agent', 'experiences_agent', END] });
workflow.addNode("flights_agent", flightsSubgraph);
workflow.addNode("hotels_agent", hotelsSubgraph);
workflow.addNode("experiences_agent", experiencesSubgraph);

// Set entry point
workflow.setEntryPoint("supervisor");
workflow.addEdge(START, "supervisor");

// Add edges back to supervisor after each subgraph
workflow.addEdge("flights_agent", "supervisor");
workflow.addEdge("hotels_agent", "supervisor");
workflow.addEdge("experiences_agent", "supervisor");

// Compile the graph
export const subGraphsAgentGraph = workflow.compile();
