import { Cr108_softwaresService } from "../generated/services/Cr108_softwaresService";
import type { Cr108_softwares } from "../generated/models/Cr108_softwaresModel";
import type { Software } from "../types/domain";
import { unwrap } from "./odata";

function toSoftware(record: Cr108_softwares): Software {
  return {
    id: record.cr108_softwareid,
    name: record.cr108_name,
  };
}

export async function listActive(): Promise<Software[]> {
  const result = await Cr108_softwaresService.getAll({
    filter: "statecode eq 0",
    orderBy: ["cr108_name asc"],
    select: ["cr108_softwareid", "cr108_name"],
  });
  return unwrap(result, "List active software").map(toSoftware);
}
