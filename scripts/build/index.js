const argv = require("minimist")(process.argv.slice(2))

const Modules = require("./modules")
const Bundles = require("./bundles")
const Packaging = require("./packaging")
const Stats = require("./stats")
const { asyncCopyTo, asyncRimRaf, asyncExecuteCommand } = require("./utils")

const rollup = require("./rollup")
const babel = require("./babel")
const noop = require("./noop")

const { UNIVERSAL, NODE, NOOP } = Bundles.bundleTypes

const builders = {
  [UNIVERSAL]: rollup,
  [NODE]: babel,
  [NOOP]: noop
}

const requestedEntries = (argv._[0] || "")
  .split(",")
  .map(name => name.toLowerCase())

function shouldSkipBundle(bundle, bundleType) {
  if (requestedEntries.length > 0) {
    const isAskingForDifferentEntries = requestedEntries.every(
      requestedName => bundle.entry.indexOf(requestedName) === -1
    )
    if (isAskingForDifferentEntries) {
      return true
    }
  }
  return false
}

async function copyFlowTypes(srcDir, outDir) {
  console.log('Generating flow types')
  return asyncExecuteCommand(
    `flow gen-flow-files --ignore ".*\.test\.js$" --out-dir ${outDir} ${srcDir}`
  )
}

async function buildEverything() {
  await asyncRimRaf("build")

  // Run them serially for better console output
  // and to avoid any potential race conditions.
  for (const bundle of Bundles.bundles) {
    if (shouldSkipBundle(bundle, bundle.type)) continue

    const builder = builders[bundle.type]
    if (!builder) {
      console.log("Unknown type")
      continue
    }

    await builder(bundle)
    if (bundle.type === UNIVERSAL || bundle.type === NODE) {
      const name = bundle.entry.replace("@lingui/", "")
      await copyFlowTypes(`packages/${name}/src`, `build/packages/${name}`)
    }
  }

  console.log(Stats.printResults())
  Stats.saveResults()

  await Packaging.prepareNpmPackages()
}

buildEverything()
