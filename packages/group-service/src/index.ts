export const GROUP_SERVICE_PACKAGE_NAME = "@agorix/group-service";
export { InMemoryGroupRepository } from "./memory.js";
export { GroupService } from "./service.js";
export type {
  CreateGroupInput,
  DeviceView,
  GroupServiceOptions,
  GroupView,
  OrganizerGroupView,
  PendingJoin,
  SlotView,
} from "./service.js";
export {
  ALIASES,
  DEFAULT_GROUP_POLICY,
  GroupError,
  TEAM_IDS,
  type AdultDirectory,
  type Clock,
  type CodeRow,
  type DeviceRow,
  type GroupAuthority,
  type GroupErrorCode,
  type GroupPolicy,
  type GroupRepository,
  type GroupRow,
  type OrganizerRow,
  type RandomSource,
  type RedeemFailureWindow,
  type SlotRow,
  type TeamId,
} from "./types.js";
export { GROUP_SERVICE_MIGRATIONS, SqlGroupRepository } from "./sql.js";
export type { GroupSqlDialect, GroupSqlExecutor, GroupSqlRow, GroupSqlValue } from "./sql.js";
