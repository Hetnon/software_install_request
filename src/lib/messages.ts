import { Cr108_messagesesService } from "../generated/services/Cr108_messagesesService";
import type {
  Cr108_messageses,
  Cr108_messagesesBase,
} from "../generated/models/Cr108_messagesesModel";
import type { Message } from "../types/domain";
import { bind, readFormatted, unwrap } from "./odata";

const SELECT_FIELDS = [
  "cr108_messagesid",
  "cr108_message_key",
  "cr108_message",
  "cr108_directed_to",
  "_cr108_request_value",
  "_createdby_value",
  "createdon",
];

function toMessage(r: Cr108_messageses): Message {
  return {
    id: r.cr108_messagesid,
    key: r.cr108_message_key,
    body: r.cr108_message,
    directedTo: r.cr108_directed_to,
    requestId: r._cr108_request_value,
    createdById: r._createdby_value,
    createdByName: readFormatted(r, "_createdby_value"),
    createdOn: r.createdon,
  };
}

export async function listForRequest(requestId: string): Promise<Message[]> {
  const result = await Cr108_messagesesService.getAll({
    filter: `_cr108_request_value eq ${requestId}`,
    orderBy: ["createdon asc"],
    select: SELECT_FIELDS,
  });
  return unwrap(result, "List messages").map(toMessage);
}

type CreatePayload = Pick<
  Cr108_messagesesBase,
  | "cr108_message_key"
  | "cr108_message"
  | "cr108_directed_to"
  | "cr108_request@odata.bind"
>;

export async function send(input: {
  requestId: string;
  body: string;
  directedTo: string;
}): Promise<Message> {
  const payload: CreatePayload = {
    cr108_message_key: `MSG-${Date.now()}`,
    cr108_message: input.body,
    cr108_directed_to: input.directedTo,
    "cr108_request@odata.bind": bind("cr108_requests", input.requestId),
  };
  const result = await Cr108_messagesesService.create(
    payload as unknown as Omit<Cr108_messagesesBase, "cr108_messagesid">,
  );
  return toMessage(unwrap(result, "Send message"));
}
