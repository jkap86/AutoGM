const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !appleTeamId) {
    console.log("Skipping notarization — APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID not set");
    return;
  }

  console.log(`Notarizing ${appName}...`);

  await notarize({
    appBundleId: "com.autogm.desktop",
    appPath: `${appOutDir}/${appName}.app`,
    appleId,
    appleIdPassword,
    teamId: appleTeamId,
  });

  console.log("Notarization complete");
};
