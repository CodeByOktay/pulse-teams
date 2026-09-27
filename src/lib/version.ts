import packageInfo from "../../package.json";

/**
 * Single source of truth for application version.
 * Automatically synchronizes with package.json.
 */
export const APP_VERSION = packageInfo.version;
