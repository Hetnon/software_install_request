import { Cr108_requestsService } from "../generated/services/Cr108_requestsService";
import type {
  Cr108_requests,
  Cr108_requestsBase,
  Cr108_requestscr108_status,
} from "../generated/models/Cr108_requestsModel";
import { REQUEST_STATUS, statusLabel } from "../types/domain";
import type { SoftwareRequest } from "../types/domain";
import { bind, readFormatted, unwrap } from "./odata";

const SELECT_FIELDS = [
  "cr108_requestid",
  "cr108_key",
  "cr108_justification",
  "cr108_status",
  "_cr108_software_value",
  "_cr108_approver_admin_value",
  "_createdby_value",
  "createdon",
  "cr108_date_resolved",
];

function toRequest(r: Cr108_requests): SoftwareRequest {
  return {
    id: r.cr108_requestid,
    key: r.cr108_key,
    justification: r.cr108_justification,
    statusCode: r.cr108_status,
    status: statusLabel(r.cr108_status),
    softwareId: r._cr108_software_value,
    softwareName: readFormatted(r, "_cr108_software_value"),
    approverId: r._cr108_approver_admin_value,
    approverName: readFormatted(r, "_cr108_approver_admin_value"),
    createdById: r._createdby_value,
    createdByName: readFormatted(r, "_createdby_value"),
    createdOn: r.createdon,
    dateResolved: r.cr108_date_resolved,
  };
}

export async function listMine(userObjectId: string): Promise<SoftwareRequest[]> {
  const result = await Cr108_requestsService.getAll({
    filter: `createdby/azureactivedirectoryobjectid eq ${userObjectId}`,
    orderBy: ["createdon desc"],
    select: SELECT_FIELDS,
  });
  return unwrap(result, "List my requests").map(toRequest);
}

export async function listPending(): Promise<SoftwareRequest[]> {
  const result = await Cr108_requestsService.getAll({
    filter: `cr108_status eq ${REQUEST_STATUS.Pending}`,
    orderBy: ["createdon asc"],
    select: SELECT_FIELDS,
  });
  return unwrap(result, "List pending requests").map(toRequest);
}

export async function listAll(): Promise<SoftwareRequest[]> {
  const result = await Cr108_requestsService.getAll({
    orderBy: ["createdon desc"],
    select: SELECT_FIELDS,
  });
  return unwrap(result, "List all requests").map(toRequest);
}

export async function get(id: string): Promise<SoftwareRequest> {
  const result = await Cr108_requestsService.get(id, { select: SELECT_FIELDS });
  return toRequest(unwrap(result, "Get request"));
}

// Dataverse auto-fills ownerid / owneridtype / statecode on create,
// but the generated Omit type still demands them. Narrow to the fields
// we actually send and cast through unknown.
type CreatePayload = Pick<
  Cr108_requestsBase,
  "cr108_key" | "cr108_status" | "cr108_software@odata.bind" | "cr108_justification"
>;

export async function create(input: {
  softwareId: string;
  justification?: string;
}): Promise<SoftwareRequest> {
  const payload: CreatePayload = {
    cr108_key: `REQ-${Date.now()}`,
    cr108_status: REQUEST_STATUS.Pending satisfies Cr108_requestscr108_status,
    "cr108_software@odata.bind": bind("cr108_softwares", input.softwareId),
    cr108_justification: input.justification,
  };
  const result = await Cr108_requestsService.create(
    payload as unknown as Omit<Cr108_requestsBase, "cr108_requestid">,
  );
  return toRequest(unwrap(result, "Create request"));
}

export type DecisionOutcome = "approve" | "reject" | "requestMoreInfo";

// Approver decision. Note: cr108_approver_admin is intentionally not set —
// binding it requires the approver's systemuser GUID, not their Entra objectId,
// which means adding 'systemuser' as a data source. The system 'modifiedby'
// field captures who decided in the meantime.
//
// 'requestMoreInfo' is not terminal: cr108_date_resolved stays empty so the
// request can move back to Pending after the requester responds.
export async function decide(input: {
  id: string;
  outcome: DecisionOutcome;
}): Promise<void> {
  let status: Cr108_requestscr108_status;
  switch (input.outcome) {
    case "approve":
      status = REQUEST_STATUS.Approved;
      break;
    case "reject":
      status = REQUEST_STATUS.Rejected;
      break;
    case "requestMoreInfo":
      status = REQUEST_STATUS.MoreInfo;
      break;
  }
  const payload: Partial<Omit<Cr108_requestsBase, "cr108_requestid">> = {
    cr108_status: status,
  };
  if (input.outcome !== "requestMoreInfo") {
    payload.cr108_date_resolved = new Date().toISOString();
  }
  const result = await Cr108_requestsService.update(input.id, payload);
  unwrap(result, "Decide on request");
}

// Requester action: move a Rejected request back to Pending. Clears the
// resolved date so the request looks fresh again to approvers.
export async function reopen(id: string): Promise<void> {
  const payload = {
    cr108_status: REQUEST_STATUS.Pending,
    cr108_date_resolved: null,
  };
  const result = await Cr108_requestsService.update(
    id,
    payload as unknown as Partial<Omit<Cr108_requestsBase, "cr108_requestid">>,
  );
  unwrap(result, "Reopen request");
}
