/* eslint-disable security/detect-child-process */
'use strict'

const Util = require('util')
const ChildProcess = require('child_process')
const ExecFile = Util.promisify(ChildProcess.execFile)

const auditCliCommand = 'node_modules/snyk/dist/cli/index.js'
const ERROR_VULNS_FOUND = 1
const ERROR_UNAUTHENTICATED = 2

class Audit {
  async authenticate() {
    return new Promise((resolve, reject) => {
      const process = ChildProcess.execFile(auditCliCommand, ['auth'])
      process.stdout.on('data', chunk => {
        const httpsLinkMatch = chunk.match(/https:\/\/.*/g)
        if (httpsLinkMatch && httpsLinkMatch.length > 0) {
          const httpsLink = httpsLinkMatch[0].trim()
          console.log()
          console.log(`or you can hit this link:`)
          console.log(`  ${httpsLink}`)
        }
      })

      process.on('close', exitCode => {
        return resolve()
      })

      process.on('error', error => {
        return reject(new Error(error))
      })
    })
  }

  async test() {
    let testResults = []

    try {
      await ExecFile(auditCliCommand, ['test', '--json'])
    } catch (error) {
      if (error.code === ERROR_VULNS_FOUND) {
        // we are authenticated as a user for Snyk
        // but vulnerabilities have been found
        testResults = JSON.parse(error.stdout)
      } else if (error.code === ERROR_UNAUTHENTICATED) {
        // user is not authenticated and we need
        // to trigger the auth process

        console.log(`Seems like you're not authenticated to Snyk,`)
        console.log(`so redirecting you now and after login I'll show scan results here`)
        await this.authenticate()
        return this.test()
      } else {
        throw error
      }
    }

    return testResults
  }
}

module.exports = Audit
