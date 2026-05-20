export const REQUEST_STATUS = {
  Approved: 1,
  Rejected: 2,
  MoreInfo: 3,
  Pending: 4,
} as const;

export type RequestStatusLabel = keyof typeof REQUEST_STATUS;
export type RequestStatusCode = (typeof REQUEST_STATUS)[RequestStatusLabel];

export function statusLabel(code: number | undefined): RequestStatusLabel | "Unknown" {
  switch (code) {
    case REQUEST_STATUS.Pending:
      return "Pending";
    case REQUEST_STATUS.Approved:
      return "Approved";
    case REQUEST_STATUS.Rejected:
      return "Rejected";
    case REQUEST_STATUS.MoreInfo:
      return "MoreInfo";
    default:
      return "Unknown";
  }
}

export interface Software {
  id: string;
  name: string;
}

export interface SoftwareRequest {
  id: string;
  key: string;
  justification?: string;
  statusCode: number;
  status: RequestStatusLabel | "Unknown";
  softwareId?: string;
  softwareName?: string;
  approverId?: string;
  approverName?: string;
  createdById?: string;
  createdByName?: string;
  createdOn?: string;
  dateResolved?: string;
}

export interface Message {
  id: string;
  key: string;
  body: string;
  directedTo?: string;
  requestId?: string;
  createdById?: string;
  createdByName?: string;
  createdOn?: string;
}
