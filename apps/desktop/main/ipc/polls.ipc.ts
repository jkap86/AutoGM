import { ipcMain } from "electron";
import { requireAccess } from "../lib/auth";
import { runQuery } from "@autogm/shared";
import {
  findBlockingRecord,
  findRecentRecord,
  recordOperation,
  pollOperationKey,
} from "../lib/operation-store";
import { getPolls, addPoll, removePoll, removePollGroup } from "../lib/poll-store";

const VALID_POLL_TYPES = new Set(["single", "multiple"]);
const VALID_POLL_PRIVACY = new Set(["public", "anonymous"]);

export function registerPollsIpc() {
  ipcMain.handle(
    "polls:create",
    async (
      _event,
      args: {
        prompt: string;
        choices: string[];
        poll_type: string;
        privacy: string;
        group_id: string;
        league_id: string;
        text?: string;
      },
    ) => {
      await requireAccess();

      const prompt = (args.prompt ?? "").trim();
      const choices = (args.choices ?? []).map((c) => c.trim()).filter(Boolean);
      const poll_type = (args.poll_type ?? "single").trim();
      const privacy = (args.privacy ?? "public").trim();
      const group_id = (args.group_id ?? "").trim();
      const league_id = (args.league_id ?? "").trim();
      const text = (args.text ?? "").trim();

      if (!prompt) throw new Error("Poll prompt is required");
      if (choices.length < 2) throw new Error("At least 2 choices required");
      if (!league_id) throw new Error("league_id is required");
      if (!group_id) throw new Error("group_id is required");
      if (!VALID_POLL_TYPES.has(poll_type))
        throw new Error(
          `Invalid poll_type: "${poll_type}" (expected: single, multiple)`,
        );
      if (!VALID_POLL_PRIVACY.has(privacy))
        throw new Error(
          `Invalid privacy: "${privacy}" (expected: public, anonymous)`,
        );

      const opKey = pollOperationKey({
        league_id,
        group_id,
        prompt,
        choices,
        poll_type,
        privacy,
      });

      // If the poll was already created remotely but createPollMessage failed,
      // skip createPoll and retry only the message step.
      const prior = findRecentRecord(opKey);
      if (prior?.status === "poll_created" && prior.result_id) {
        const stored = getPolls();
        if (!stored.some((p) => p.poll_id === prior.result_id)) {
          addPoll({
            poll_id: prior.result_id,
            group_id,
            league_id,
            prompt,
            choices,
            choices_order: [],
            poll_type,
            privacy,
            created_at: prior.created_at,
          });
        }

        const messageResult = await runQuery("createPollMessage", {
          parent_id: league_id,
          attachment_id: prior.result_id,
          text,
        });
        recordOperation(opKey, "success", prior.result_id);
        return { poll_id: prior.result_id, message: messageResult };
      }

      const blocking = findBlockingRecord(opKey);
      if (blocking) {
        throw new Error(
          `Duplicate poll blocked (status: ${blocking.status}, poll: ${blocking.result_id})`,
        );
      }

      recordOperation(opKey, "pending");

      let poll_id: string;
      try {
        const sleeperPollType = poll_type === "multiple" ? "multi" : poll_type;
        const pollResult = await runQuery("createPoll", {
          prompt,
          choices,
          k_metadata: ["poll_type", "privacy"],
          v_metadata: [sleeperPollType, privacy],
        });

        poll_id = pollResult.create_poll.poll_id;

        recordOperation(opKey, "poll_created", poll_id);

        addPoll({
          poll_id,
          group_id,
          league_id,
          prompt,
          choices,
          choices_order: pollResult.create_poll.choices_order as string[],
          poll_type,
          privacy,
          created_at: Date.now(),
        });
      } catch (err) {
        recordOperation(opKey, "failed");
        throw err;
      }

      const messageResult = await runQuery("createPollMessage", {
        parent_id: league_id,
        attachment_id: poll_id,
        text,
      });

      recordOperation(opKey, "success", poll_id);

      return { poll_id, message: messageResult };
    },
  );

  ipcMain.handle("polls:list", async () => {
    await requireAccess();
    return getPolls();
  });

  ipcMain.handle("polls:remove", async (_event, pollId: string) => {
    await requireAccess();
    removePoll(pollId);
  });

  ipcMain.handle("polls:remove-group", async (_event, groupId: string) => {
    await requireAccess();
    removePollGroup(groupId);
  });
}
