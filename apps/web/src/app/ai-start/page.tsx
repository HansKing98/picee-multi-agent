"use client";
import "@copilotkit/react-ui/styles.css";

import { CopilotKit } from "@copilotkit/react-core";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { useState } from "react";

export default function CopilotKitPage() {

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="starterAgent">
      <Main />
    </CopilotKit>
  );
}

const Main = () => {
  const [themeColor, setThemeColor] = useState("#6366f1");

  // 🪁 Frontend Actions: https://docs.copilotkit.ai/guides/frontend-actions
  useCopilotAction({
    name: "setThemeColor",
    description: "设置页面的主题色。",
    parameters: [
      {
        name: "themeColor",
        description: "要设置的主题色（十六进制色值），请选用协调美观的颜色。",
        required: true,
      },
    ],
    handler({ themeColor }) {
      setThemeColor(themeColor);
    },
  });

  return (
    <main
    style={
      { "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties
    }
  >
       <YourMainContent themeColor={themeColor} />
        <CopilotSidebar
          clickOutsideToClose={false}
          defaultOpen={true}
          labels={{
            title: "弹窗助手",
            initial:
              "👋 你好！你正在与智能体对话。本示例内置了一些工具，方便你快速上手。\n\n可以试试：\n- **前端工具**：「把主题改成橙色」\n- **共享状态**：「写一句关于人工智能的谚语」\n- **生成式 UI**：「查一下旧金山天气」\n\n与智能体交互时，界面会实时反映其**状态**、**工具调用**与**进度**。",
          }}
        />
        </main>
  );
};

// State of the agent, make sure this aligns with your agent's state.
type AgentState = {
  proverbs: string[];
};

function YourMainContent({ themeColor }: { themeColor: string }) {
  // 🪁 Shared State: https://docs.copilotkit.ai/coagents/shared-state
  const { state, setState } = useCoAgent<AgentState>({
    name: "starterAgent",
    initialState: {
      proverbs: [
        "CopilotKit 虽新，却好比面包切片之后的那层惊喜。",
      ],
    },
  });

  // 🪁 Frontend Actions: https://docs.copilotkit.ai/coagents/frontend-actions
  useCopilotAction(
    {
      name: "addProverb",
      description: "向列表中添加一条谚语。",
      parameters: [
        {
          name: "proverb",
          description: "要添加的谚语，需简短、有趣、朗朗上口。",
          required: true,
        },
      ],
      handler: ({ proverb }) => {
        setState((prevState) => ({
          ...prevState,
          proverbs: [...(prevState?.proverbs || []), proverb],
        }));
      },
    },
    [setState],
  );

  //🪁 Generative UI: https://docs.copilotkit.ai/coagents/generative-ui
  useCopilotAction({
    name: "getWeather",
    description: "查询指定地点的天气。",
    available: "disabled",
    parameters: [
      {
        name: "location",
        type: "string",
        description: "要查询天气的地点名称，例如「旧金山」。",
        required: true,
      },
    ],
    render: ({ args }) => {
      return <WeatherCard location={args.location} themeColor={themeColor} />;
    },
  });

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="h-screen w-screen flex justify-center items-center flex-col transition-colors duration-300"
    >
      <div className="bg-white/20 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-2xl w-full">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">
          谚语
        </h1>
        <p className="text-gray-200 text-center italic mb-6">
          本页为演示用途，你也可以把它换成任意业务场景。🪁
        </p>
        <hr className="border-white/20 my-6" />
        <div className="flex flex-col gap-3">
          {state.proverbs?.map((proverb, index) => (
            <div
              key={index}
              className="bg-white/15 p-4 rounded-xl text-white relative group hover:bg-white/20 transition-all"
            >
              <p className="pr-8">{proverb}</p>
              <button
                onClick={() =>
                  setState({
                    ...state,
                    proverbs: state.proverbs?.filter((_, i) => i !== index),
                  })
                }
                className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity
                  bg-red-500 hover:bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {state.proverbs?.length === 0 && (
          <p className="text-center text-white/80 italic my-8">
            暂无谚语，请让助手为你添加几条吧！
          </p>
        )}
      </div>
    </div>
  );
}

// Simple sun icon for the weather card
function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-14 h-14 text-yellow-200"
    >
      <circle cx="12" cy="12" r="5" />
      <path
        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        strokeWidth="2"
        stroke="currentColor"
      />
    </svg>
  );
}

// Weather card component where the location and themeColor are based on what the agent
// sets via tool calls.
function WeatherCard({
  location,
  themeColor,
}: {
  location?: string;
  themeColor: string;
}) {
  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="rounded-xl shadow-xl mt-6 mb-4 max-w-md w-full"
    >
      <div className="bg-white/20 p-4 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white capitalize">
              {location}
            </h3>
            <p className="text-white">当前天气</p>
          </div>
          <SunIcon />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="text-3xl font-bold text-white">70°</div>
          <div className="text-sm text-white">晴朗</div>
        </div>

        <div className="mt-4 pt-4 border-t border-white">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-white text-xs">湿度</p>
              <p className="text-white font-medium">45%</p>
            </div>
            <div>
              <p className="text-white text-xs">风速</p>
              <p className="text-white font-medium">5 英里/时</p>
            </div>
            <div>
              <p className="text-white text-xs">体感</p>
              <p className="text-white font-medium">72°</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
