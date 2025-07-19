let fs = require("fs");
let command = require("command");
let { fetchSync } = require("fetch");
let pully = require("pully");

let { waitUntil } = require("listener");
let { checkUpdate, checkUpdateSync } = module.require("./");

let client = Yarn.net.minecraft.client.MinecraftClient.getInstance();
let loader = Packages.net.fabricmc.loader.api.FabricLoader.getInstance();

function notify() {
    console.info("There is an update avaiable.");
    console.info("Run `/updater pull` to update init scripts.");
}

function check(upToDate = () => {}) {
    Promise(() => {
        let hasUpdate;

        checkUpdateSync(
            () => (hasUpdate = true),
            () => (hasUpdate = false),
        );

        let index = pully.indexSync();
        let localManifests = pully.getLocalManifestsSync();

        let outdated = pully.getOutdatedSync(index, localManifests);

        function shouldUpdate(local, remote) {
            let currentVersion = local.split(".").map((n) => parseInt(n));
            let newVersion = remote.split(".").map((n) => parseInt(n));
            for (
                let i = 0;
                i < Math.min(currentVersion.length, newVersion.length);
                i++
            ) {
                if (currentVersion[i] > newVersion[i]) return false;
                if (currentVersion[i] < newVersion[i]) return true;
            }

            return currentVersion.length < newVersion.length;
        }

        let gameVersion = client.getGameVersion();

        function modVersions(name) {
            let local =
                loader
                    .getModContainer(name)
                    .get()
                    .getMetadata()
                    .getVersion()
                    .getFriendlyString() + "";

            try {
                let remote = fetchSync(
                    `https://api.modrinth.com/v2/project/${name}/version?game_versions=[%22${gameVersion}%22]`,
                ).json();
                return [local, remote];
            } catch {
                return [local, "0.0.0"];
            }
        }

        let [jscVersion, remoteJscVersions] = modVersions("jscore");
        let [yarnwrapVersion, remoteYarnwrapVersions] = modVersions("yarnwrap");

        let jscUpdate;
        if (remoteJscVersions.length != 0) {
            let remoteVersion = remoteJscVersions[0].version_number;
            if (shouldUpdate(jscVersion, remoteVersion)) {
                jscUpdate = [jscVersion, remoteVersion];
                hasUpdate = true;
            }
        }

        let yarnwrapUpdate;
        if (remoteJscVersions.length != 0) {
            let remoteVersion = remoteYarnwrapVersions[0].version_number;
            if (shouldUpdate(yarnwrapVersion, remoteVersion)) {
                yarnwrapUpdate = [yarnwrapVersion, remoteVersion];
                hasUpdate = true;
            }
        }

        if (
            !hasUpdate &&
            outdated.length == 0 &&
            jscUpdate == undefined &&
            yarnwrapUpdate == undefined
        ) {
            upToDate();
            return;
        }

        function notify() {
            if (hasUpdate)
                console.warn(
                    "Your init scripts are out of date, run `/updater pull` to update.",
                );

            if (outdated.length != 0)
                console.warn(
                    `You have ${outdated.length} outdated package${outdated.length < 2 ? "" : "s"}, run \`/pully install\` to update.`,
                );

            if (jscUpdate)
                console.warn(
                    `There is a newer version of JSCore: ${jscUpdate[0]} -> ${jscUpdate[1]}}`,
                );

            if (yarnwrapUpdate)
                console.warn(
                    `There is a newer version of Yarnwrap: ${yarnwrapUpdate[0]} -> ${yarnwrapUpdate[1]}}`,
                );
        }

        if (client.player == null) {
            waitUntil("startClientWorldTickEvent", notify);
        } else {
            notify();
        }
    });
}

// cooldown 5 mins to not hit the github api rate limit
if (
    module.globals.updater == undefined ||
    Date.now() - (module.globals.updater.lastChecked ?? 0) > 300000
) {
    check();
}

command.register({
    name: "updater",

    subcommands: {
        check: {
            execute: () =>
                check(() => {
                    console.info("Your game is up to date. Yay!");
                }),
        },
        pull: {
            execute: () => {
                checkUpdate(
                    (latestHash) => {
                        console.info("Checking updates...");
                        let repoPath =
                            "https://raw.githubusercontent.com/FabricCore/bootstrap.js/refs/heads/master";

                        let init = fetchSync(`${repoPath}/init.js`);
                        let prelude = fetchSync(`${repoPath}/prelude.js`);
                        let stop = fetchSync(`${repoPath}/stop.js`);

                        fs.writeFileSync("init.js", init.bytes());
                        fs.writeFileSync("prelude.js", prelude.bytes());
                        fs.writeFileSync("stop.js", stop.bytes());

                        fs.mkdirSync("storage/updater");
                        fs.writeFileSync(
                            "storage/updater/bootstrap.json",
                            JSON.stringify(
                                { currentHash: latestHash },
                                null,
                                2,
                            ),
                        );
                        console.info("Init scripts has been updated.");
                    },
                    () => {
                        console.info(
                            "You init scripts are up to date, not updated.",
                        );
                    },
                );
            },
        },
    },
});
