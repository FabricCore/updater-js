let fs = require("fs");
let { fetchSync } = require("fetch");

function checkUpdateSync(hasUpdate, noUpdate) {
    hasUpdate ??= () => {};
    noUpdate ??= () => {};

    let res = fetchSync(
        "https://api.github.com/repos/fabriccore/bootstrap.js/commits",
    );
    let json = res.json();

    if (json.message) {
        console.error(
            json.message.replace(
                /[0-9]*\.[0-9]*\.[0-9]*\.[0-9]*/,
                "[redacted IP address]",
            ),
        );
        return;
    }

    let latestHash = json[0].sha;

    let currentHash;

    if (fs.existsSync("storage/updater/bootstrap.json"))
        currentHash =
            require("../../storage/updater/bootstrap.json").currentHash;

    if (latestHash == currentHash) noUpdate();
    else hasUpdate(latestHash);
}

function checkUpdate(hasUpdate, noUpdate) {
    return Promise(() => checkUpdateSync(hasUpdate, noUpdate));
}

module.exports = { checkUpdate, checkUpdateSync };
