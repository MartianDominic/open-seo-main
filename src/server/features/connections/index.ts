/**
 * Site Connections Feature
 *
 * Barrel export for platform detection, credential encryption,
 * and connection management services.
 */

// Services
export {
  detectPlatform,
  DETECTION_PROBES,
} from "./services/PlatformDetector";

export {
  encryptCredential,
  decryptCredential,
  validateEncryptionKey,
} from "./services/CredentialEncryption";

// Types
export type {
  PlatformType,
  ConnectionStatus,
  DetectionResult,
  DetectionSignal,
} from "./types";

export { PLATFORM_TYPES, CONNECTION_STATUS } from "./types";
