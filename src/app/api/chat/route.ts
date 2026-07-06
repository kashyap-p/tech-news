import { NextResponse } from "next/server";
import { chatAboutNews, getChatHistory, clearChatHistory } from "@/lib/ai";
import { getOrCreateSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET    /api/chat  — recent chat history for this session
 * POST   /api/chat  { message: string } — send a message to Pulse, the news assistant
 * DELETE /api/chat  — clear chat history for this session
 */
export async function GET() {
  const sessionId = await getOrCreateSessionId();
  const history = await getChatHistory(sessionId);
  return NextResponse.json({ success: true, sessionId, history });
}

export async function POST(req: Request) {
  try {
    const sessionId = await getOrCreateSessionId();
    const { message } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: "message required" }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ success: false, error: "Message too long" }, { status: 400 });
    }
    const { reply, context } = await chatAboutNews(sessionId, message.trim());
    return NextResponse.json({ success: true, reply, context });
  } catch (err: any) {
    console.error("[api/chat] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const sessionId = await getOrCreateSessionId();
    await clearChatHistory(sessionId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[api/chat DELETE] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
