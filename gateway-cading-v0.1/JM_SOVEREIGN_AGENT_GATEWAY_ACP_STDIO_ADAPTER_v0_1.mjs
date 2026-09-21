import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import * as acp from '@agentclientprotocol/sdk';
import { createGatewayCarrier } from './JM_SOVEREIGN_AGENT_GATEWAY_API_CARRIER_v0_1.mjs';

const gateway = await createGatewayCarrier({
  gatewayToken: process.env.JM_GATEWAY_TOKEN || 'ACP_INTERNAL_PROCESS_BOUNDARY',
});
const { runtime } = gateway;
const sessions = new Map();

function invoke(name, args = []) {
  return runtime.invoke(name, args);
}

function textFromPrompt(blocks = []) {
  return blocks.map((block) => {
    if (block?.type === 'text') return String(block.text || '');
    return `[ACP ${String(block?.type || 'content')} block]`;
  }).join('\n').trim();
}

async function notifyText(cx, sessionId, text) {
  await cx.notify(acp.methods.client.session.update, {
    sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text },
    },
  });
}

const implementation = {
  async initialize() {
    return {
      protocolVersion: acp.PROTOCOL_VERSION,
      agentCapabilities: { loadSession: false },
    };
  },

  async newSession(params) {
    const sessionId = randomUUID();
    sessions.set(sessionId, { cwd: params.cwd, lastTaskId: null });
    return { sessionId };
  },

  async authenticate() {
    return {};
  },

  async prompt(params, cx) {
    const session = sessions.get(params.sessionId);
    if (!session) throw new Error(`Session ${params.sessionId} not found`);

    const prompt = textFromPrompt(params.prompt);
    const taskId = invoke('createTask', [prompt || '[empty ACP prompt]', 'acp-client-request']);
    session.lastTaskId = taskId;
    const task = invoke('taskStatus', [taskId]);
    const toolCallId = `jm-authority:${taskId}`;

    await notifyText(
      cx,
      params.sessionId,
      `JM task ${taskId} created in Cading. Status: ${task.status}. Human authority is required before dispatch.`,
    );

    await cx.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'tool_call',
        toolCallId,
        title: `Authorize JM task ${taskId}`,
        kind: 'other',
        status: 'pending',
        rawInput: {
          taskId,
          prompt,
          sourceAuthority: 'Cading / JM Coding Estate',
          requestedRoute: 'approveTask -> dispatchTask',
        },
      },
    });

    const permission = await cx.request(
      acp.methods.client.session.requestPermission,
      {
        sessionId: params.sessionId,
        toolCall: {
          toolCallId,
          title: `Authorize JM task ${taskId}`,
          kind: 'other',
          status: 'pending',
          rawInput: { taskId, prompt },
        },
        options: [
          { kind: 'allow_once', name: 'Approve and dispatch once', optionId: 'jm-approve-once' },
          { kind: 'reject_once', name: 'Keep task held', optionId: 'jm-reject-once' },
        ],
      },
    );

    if (permission.outcome.outcome === 'cancelled' || permission.outcome.optionId === 'jm-reject-once') {
      await cx.notify(acp.methods.client.session.update, {
        sessionId: params.sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId,
          status: 'failed',
          rawOutput: { taskId, state: 'HELD_BY_HUMAN_AUTHORITY' },
        },
      });
      await notifyText(cx, params.sessionId, `JM task ${taskId} remains held. No dispatch Ding was issued.`);
      return { stopReason: 'end_turn' };
    }

    if (permission.outcome.optionId !== 'jm-approve-once') {
      throw new Error(`Unexpected permission outcome ${JSON.stringify(permission.outcome)}`);
    }

    invoke('approveTask', [taskId]);
    const dispatchResult = invoke('dispatchTask', [taskId]);
    const finalTask = invoke('taskStatus', [taskId]);

    await cx.notify(acp.methods.client.session.update, {
      sessionId: params.sessionId,
      update: {
        sessionUpdate: 'tool_call_update',
        toolCallId,
        status: 'completed',
        rawOutput: {
          taskId,
          dispatchResult,
          task: finalTask,
          sourceAuthority: 'Cading / JM Coding Estate',
        },
      },
    });
    await notifyText(
      cx,
      params.sessionId,
      `Human approval reached Cading. ${taskId} is now ${finalTask.status}. External-agent execution is not claimed until a worker adapter returns a Ding.`,
    );

    return { stopReason: 'end_turn' };
  },

  async cancel(params) {
    const session = sessions.get(params.sessionId);
    if (session) session.cancelled = true;
  },
};

const input = Writable.toWeb(process.stdout);
const output = Readable.toWeb(process.stdin);
const stream = acp.ndJsonStream(input, output);

acp
  .agent({ name: 'jm-sovereign-agent-gateway' })
  .onRequest(acp.methods.agent.initialize, (ctx) => implementation.initialize(ctx.params))
  .onRequest(acp.methods.agent.session.new, (ctx) => implementation.newSession(ctx.params))
  .onRequest(acp.methods.agent.authenticate, (ctx) => implementation.authenticate(ctx.params))
  .onRequest(acp.methods.agent.session.prompt, (ctx) => implementation.prompt(ctx.params, ctx.client))
  .onNotification(acp.methods.agent.session.cancel, (ctx) => implementation.cancel(ctx.params))
  .connect(stream);
