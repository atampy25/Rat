/*
 *     The Peacock Project - a HITMAN server replacement.
 *     Copyright (C) 2021-2022 The Peacock Project Team
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU Affero General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU Affero General Public License for more details.
 *
 *     You should have received a copy of the GNU Affero General Public License
 *     along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { existsSync } from "fs"
import { join, basename } from "path"
import millis from "ms"
import { mkdir, readdir, readFile, unlink, writeFile } from "fs/promises"
import { createHash } from "crypto"
import { Packr } from "msgpackr"
import { brotliCompress } from "zlib"
import { promisify } from "util"
import glob from "glob"

const packer = new Packr({
    bundleStrings: true,
})

async function readJson(filePath) {
    return JSON.parse((await readFile(filePath)).toString())
}

export async function packContractsAndChallenges() {
    const resources = join("resources", "challenges")

    if (!existsSync(resources)) {
        await mkdir(resources)
    } else {
        for (const crp of await readdir(resources)) {
            await unlink(join(resources, crp))
        }
    }

    const start = Date.now()

    const contracts = glob.sync("contractdata/**/*.json")
    const b = []
    const el = []

    const handleChallengeFile = async (name, contents) => {
        const targetName = createHash("md5").update(name).digest("hex")

        await writeFile(
            join(resources, `${targetName}.crp`),
            packer.pack(contents),
        )
    }

    for (const path of contracts) {
        const filename = basename(path)

        if (
            [
                "FREEDOMFIGHTERSLEGACY.json",
                "THELASTYARDBIRD_SCPC.json",
            ].includes(filename)
        ) {
            continue
        }

        if (filename.includes(".d.ts")) {
            return
        }

        const json = await readJson(path)

        if (filename.startsWith("_")) {
            // _LOCATION_CHALLENGES.json
            await handleChallengeFile(filename + "#packed", json)
            continue
        }

        switch (json?.Metadata?.Type) {
            case "elusive":
                el.push(json)
                break
            default:
                b.push(json)
        }
    }

    const d = JSON.stringify({ b, el })
    const compressed = await promisify(brotliCompress)(d)
    await writeFile("resources/contracts.br", compressed)

    console.log(
        `Gathered built-in contracts and challenges in ${millis(
            Date.now() - start,
        )}`,
    )
}
