let fs = require("fs");
let command = require("command");
let { fetchSync } = require("fetch");
let pully = require("pully");

let { waitUntil } = require("listener");
let { checkUpdate, checkUpdateSync } = module.require("./");

let client = Yarn.net.minecraft.client.MinecraftClient.getInstance();

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

        if (!hasUpdate && outdated.length == 0) {
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
                    `You have ${outdated.length} outdated packages, run \`/pully install\` to update.`,
                );
        }

        if (client.player == null) {
            waitUntil("startClientWorldTickEvent", notify);
        } else {
            notify();
        }
    });
}

check();

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
