let fs = require("fs");
let command = require("command");
let { fetchSync } = require("fetch");
let pully = require("pully");
let text = require("text");
let config = require("config");

let { waitUntil } = require("listener");
let { checkUpdate, checkUpdateSync } = module.require("./");

let client = Yarn.net.minecraft.client.MinecraftClient.getInstance();
let loader = Packages.net.fabricmc.loader.api.FabricLoader.getInstance();

let warn = "\u00A78[\u00A7e\u00A7lWARN\u00A78]";

function check(upToDate = () => {}) {
    Promise(() => {
        let hasUpdate;
        let initScriptUpdate;

        checkUpdateSync(
            () => {
                hasUpdate = true;
                initScriptUpdate = true;
            },
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
            if (initScriptUpdate)
                text.sendText([
                    warn,
                    "Your init scripts are out of date, run ",
                    {
                        content: "\u00A7a/updater pull",
                        hover: "Run command \u00a7a/updater pull",
                        click: "/updater pull",
                    },
                    " to update.",
                ]);

            if (outdated.length != 0)
                text.sendText([
                    warn,
                    `You have ${outdated.length} outdated package${outdated.length < 2 ? "" : "s"}, run `,
                    {
                        content: "\u00A7a/pully install",
                        hover: "Run command \u00a7a/pully install",
                        click: "/updater pull",
                    },
                    " to update.",
                ]);

            if (jscUpdate)
                text.sendText([
                    warn,
                    `There is a newer version of JSCore! \u00A7c${jscUpdate[0]}\u00A7r \u00A77> \u00A7a${jscUpdate[1]} `,
                    {
                        content: "\u00A78[\u00A7e\u00A7lModrinth\u00A78]",
                        hover: "Open in Modrinth",
                        click: "https://modrinth.com/mod/jscore",
                    },
                ]);

            if (yarnwrapUpdate)
                text.sendText([
                    warn,
                    `There is a newer version of JSCore! \u00A7c${yarnwrapUpdate[0]}\u00A7r \u00A77> \u00A7a${yarnwrapUpdate[1]} `,
                    {
                        content: "\u00A78[\u00A7e\u00A7lModrinth\u00A78]",
                        hover: "Open in Modrinth",
                        click: "https://modrinth.com/mod/yarnwrap",
                    },
                ]);
        }

        if (client.player == null) {
            waitUntil("startClientWorldTickEvent", notify);
        } else {
            notify();
        }
    });
}

let options;

function getOptions(forced) {
    options = config.load("updater") ?? {};
    options.interval ??= 10800;
    Math.max(Math.min(259200, options.interval), 0);
    options.lastChecked ??= 0;

    let now = Math.floor(Date.now() / 1000);
    options.lastChecked = Math.min(options.lastChecked, now);
    let shouldCheck = now - options.lastChecked > options.interval;

    if (shouldCheck || forced) {
        options.lastChecked = now;
    }
    config.save("updater", options);

    return shouldCheck;
}

if (getOptions()) {
    check();
}

command.register({
    name: "updater",

    subcommands: {
        check: {
            execute: () => {
                getOptions(true);
                check(() => {
                    console.info("Your game is up to date. Yay!");
                });
            },
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
