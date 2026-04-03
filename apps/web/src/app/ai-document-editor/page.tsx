"use client";
import "@copilotkit/react-core/v2/styles.css";
import "./style.css";

import MarkdownIt from "markdown-it";
import React from "react";

import { diffWords } from "diff";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState, useRef } from "react";
import { 
  useAgent,
  UseAgentUpdate,
  useHumanInTheLoop,
  useConfigureSuggestions,
  CopilotChat,
  CopilotSidebar,
} from "@copilotkit/react-core/v2";
import { z } from "zod";
import { useMobileView } from "@/utils/use-mobile-view";
import { useMobileChat } from "@/utils/use-mobile-chat";
import { useURLParams } from "@/contexts/url-params-context";
import { CopilotKit } from "@copilotkit/react-core";

const extensions = [StarterKit];

interface PredictiveStateUpdatesProps {
  params: Promise<{
    integrationId: string;
  }>;
}

export default function PredictiveStateUpdates({ params }: PredictiveStateUpdatesProps) {
  // const { integrationId ='199901' } = React.use(params);
  const { isMobile } = useMobileView();
  const { chatDefaultOpen } = useURLParams();
  const defaultChatHeight = 50;
  const { isChatOpen, setChatHeight, setIsChatOpen, isDragging, chatHeight, handleDragStart } =
    useMobileChat(defaultChatHeight);
  const chatTitle = "AI 文档编辑器";
  const chatDescription = "让我帮您创建或编辑文档";

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      showDevConsole={true}
      agent="predictive_state_updates"
    >
      <div
        className="min-h-screen w-full"
        style={
          {
            // "--copilot-kit-primary-color": "#222",
            // "--copilot-kit-separator-color": "#CCC",
          } as React.CSSProperties
        }
      >
        {isMobile ? (
          <>
            {/* Chat Toggle Button */}
            <div className="fixed bottom-0 left-0 right-0 z-50">
              <div className="bg-gradient-to-t from-white via-white to-transparent h-6"></div>
              <div
                className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between cursor-pointer shadow-lg"
                onClick={() => {
                  if (!isChatOpen) {
                    setChatHeight(defaultChatHeight); // Reset to good default when opening
                  }
                  setIsChatOpen(!isChatOpen);
                }}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="font-medium text-gray-900">{chatTitle}</div>
                    <div className="text-sm text-gray-500">{chatDescription}</div>
                  </div>
                </div>
                <div
                  className={`transform transition-transform duration-300 ${isChatOpen ? "rotate-180" : ""}`}
                >
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Pull-Up Chat Container */}
            <div
              className={`fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-2xl shadow-[0px_0px_20px_0px_rgba(0,0,0,0.15)] transform transition-all duration-300 ease-in-out flex flex-col ${
                isChatOpen ? "translate-y-0" : "translate-y-full"
              } ${isDragging ? "transition-none" : ""}`}
              style={{
                height: `${chatHeight}vh`,
                paddingBottom: "env(safe-area-inset-bottom)", // Handle iPhone bottom padding
              }}
            >
              {/* Drag Handle Bar */}
              <div
                className="flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing"
                onMouseDown={handleDragStart}
              >
                <div className="w-12 h-1 bg-gray-400 rounded-full hover:bg-gray-500 transition-colors"></div>
              </div>

              {/* Chat Header */}
              <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">{chatTitle}</h3>
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg
                      className="w-5 h-5 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Chat Content - Flexible container for messages and input */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden pb-16">
                <CopilotChat
                  agentId="predictive_state_updates"
                  className="h-full flex flex-col"
                />
              </div>
            </div>

            {/* Backdrop */}
            {isChatOpen && (
              <div className="fixed inset-0 z-30" onClick={() => setIsChatOpen(false)} />
            )}
          </>
        ) : (
          <CopilotSidebar
            agentId="predictive_state_updates"
            defaultOpen={chatDefaultOpen}
            labels={{
              modalHeaderTitle: chatTitle,
            }}
          />
        )}
        <DocumentEditor />
      </div>
    </CopilotKit>
  );
}

interface AgentState {
  document: string;
}

const DocumentEditor = () => {
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "min-h-screen p-10" },
    },
  });
  const [placeholderVisible, setPlaceholderVisible] = useState(false);
  const [currentDocument, setCurrentDocument] = useState("");

  useConfigureSuggestions({
    suggestions: [
      {
        title: "写一个海盗的故事",
        message: "请写一个关于名叫“糖胡子”的海盗的故事。",
      },
      {
        title: "写一个美人鱼的故事",
        message: "请写一个关于名叫“露娜”的美人鱼的故事。",
      },
      { title: "添加角色", message: "请添加一个名叫“勇气”的角色。" },
    ],
    available: "always",
  });

  const { agent } = useAgent({
    agentId: "predictive_state_updates",
    updates: [UseAgentUpdate.OnStateChanged, UseAgentUpdate.OnRunStatusChanged],
  });
  

  const agentState = agent.state as AgentState | undefined;
  const setAgentState = (s: AgentState) => agent.setState(s);
  const isLoading = agent.isRunning;

  // Track when a run transitions from running to not running (replaces nodeName == "end")
  const wasRunning = useRef(false);

  useEffect(() => {
    if (isLoading) {
      setCurrentDocument(editor?.getText() || "");
    }
    editor?.setEditable(!isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (wasRunning.current && !isLoading) {
      // Run just finished - set the text one final time
      if (currentDocument.trim().length > 0 && currentDocument !== agentState?.document) {
        const newDocument = agentState?.document || "";
        const diff = diffPartialText(currentDocument, newDocument, true);
        const markdown = fromMarkdown(diff);
        editor?.commands.setContent(markdown);
      }
    }
    wasRunning.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) {
      if (currentDocument.trim().length > 0) {
        const newDocument = agentState?.document || "";
        const diff = diffPartialText(currentDocument, newDocument);
        const markdown = fromMarkdown(diff);
        editor?.commands.setContent(markdown);
      } else {
        const markdown = fromMarkdown(agentState?.document || "");
        editor?.commands.setContent(markdown);
      }
    }
  }, [agentState?.document]);

  const text = editor?.getText() || "";

  useEffect(() => {
    setPlaceholderVisible(text.length === 0);

    if (!isLoading) {
      setCurrentDocument(text);
      setAgentState({
        document: text,
      });
    }
  }, [text]);


  // Action to write the document.
  useHumanInTheLoop(
    {
      agentId: "predictive_state_updates",
      name: "write_document",
      description: `将建议的修改展示给用户进行核对`,
        parameters: z.object({
        document: z.string().describe("完整的更新后的 markdown 格式文档"),
      }) ,
      render({ args, status, respond }: { args: { document?: string }; status: string; respond?: (result: unknown) => Promise<void> }) {
        if (status === "executing") {
          return (
            <ConfirmChanges
              args={args}
              respond={respond}
              status={status}
              onReject={() => {
                editor?.commands.setContent(fromMarkdown(currentDocument));
                setAgentState({ document: currentDocument });
              }}
              onConfirm={() => {
                editor?.commands.setContent(fromMarkdown(agentState?.document || ""));
                setCurrentDocument(agentState?.document || "");
                setAgentState({ document: agentState?.document || "" });
              }}
            />
          );
        }
        return <></>;
      },
    },
    [agentState?.document],
  );

  return (
    <div className="relative min-h-screen w-full">
      {placeholderVisible && (
        <div className="absolute top-6 left-6 m-4 pointer-events-none text-gray-400">
          在此处以 Markdown 格式输入您想要的任何内容...
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};

interface ConfirmChangesProps {
  args: any;
  respond: any;
  status: any;
  onReject: () => void;
  onConfirm: () => void;
}

function ConfirmChanges({ args, respond, status, onReject, onConfirm }: ConfirmChangesProps) {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  return (
    <div
      data-testid="confirm-changes-modal"
      className="bg-white p-6 rounded shadow-lg border border-gray-200 mt-5 mb-5"
    >
      <h2 className="text-lg font-bold mb-4">确认修改</h2>
      <p className="mb-6">您要接受这些修改吗？</p>
      {accepted === null && (
        <div className="flex justify-end space-x-4">
          <button
            data-testid="reject-button"
            className={`bg-gray-200 text-black py-2 px-4 rounded disabled:opacity-50 ${
              status === "executing" ? "cursor-pointer" : "cursor-default"
            }`}
            disabled={status !== "executing"}
            onClick={() => {
              if (respond) {
                setAccepted(false);
                onReject();
                respond({ accepted: false });
              }
            }}
          >
            拒绝
          </button>
          <button
            data-testid="confirm-button"
            className={`bg-black text-white py-2 px-4 rounded disabled:opacity-50 ${
              status === "executing" ? "cursor-pointer" : "cursor-default"
            }`}
            disabled={status !== "executing"}
            onClick={() => {
              if (respond) {
                setAccepted(true);
                onConfirm();
                respond({ accepted: true });
              }
            }}
          >
            确认
          </button>
        </div>
      )}
      {accepted !== null && (
        <div className="flex justify-end">
          <div
            data-testid="status-display"
            className="mt-4 bg-gray-200 text-black py-2 px-4 rounded inline-block"
          >
            {accepted ? "✓ 已接受" : "✗ 已拒绝"}
          </div>
        </div>
      )}
    </div>
  );
}

function fromMarkdown(text: string) {
  const md = new MarkdownIt({
    typographer: true,
    html: true,
  });

  return md.render(text);
}

function diffPartialText(oldText: string, newText: string, isComplete: boolean = false) {
  let oldTextToCompare = oldText;
  if (oldText.length > newText.length && !isComplete) {
    // make oldText shorter
    oldTextToCompare = oldText.slice(0, newText.length);
  }

  const changes = diffWords(oldTextToCompare, newText);

  let result = "";
  changes.forEach((part) => {
    if (part.added) {
      result += `<em>${part.value}</em>`;
    } else if (part.removed) {
      result += `<s>${part.value}</s>`;
    } else {
      result += part.value;
    }
  });

  if (oldText.length > newText.length && !isComplete) {
    result += oldText.slice(newText.length);
  }

  return result;
}

function isAlpha(text: string) {
  return /[a-zA-Z\u00C0-\u017F]/.test(text.trim());
}
