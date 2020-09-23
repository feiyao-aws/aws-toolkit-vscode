/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { activate as activateSSMLanguageServer } from './ssm/ssmClient'
import { AwsContext } from '../shared/awsContext'

import { createSsmDocumentFromTemplate } from './commands/createDocumentFromTemplate'
import { publishSSMDocument } from './commands/publishDocument'
import { RegionProvider } from '../shared/regions/regionProvider'
import * as telemetry from '../shared/telemetry/telemetry'
import { openDocumentItem, openDocumentItemJson, openDocumentItemYaml } from './commands/openDocumentItem'
import { DocumentItemNode } from './explorer/documentItemNode'
import { deleteDocument } from './commands/deleteDocument'
import { DocumentItemNodeWriteable } from './explorer/documentItemNodeWriteable'
import { executeDocument } from './commands/executeDocument'
import { updateDocumentVersion } from './commands/updateDocumentVersion'

// Activate SSM Document related functionality for the extension.
export async function activate(
    extensionContext: vscode.ExtensionContext,
    awsContext: AwsContext,
    regionProvider: RegionProvider,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    await registerSsmDocumentCommands(extensionContext, awsContext, regionProvider, outputChannel)
    await activateSSMLanguageServer(extensionContext)
}

async function registerSsmDocumentCommands(
    extensionContext: vscode.ExtensionContext,
    awsContext: AwsContext,
    regionProvider: RegionProvider,
    outputChannel: vscode.OutputChannel
): Promise<void> {
    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.createLocalDocument', async () => {
            try {
                await createSsmDocumentFromTemplate(extensionContext)
            } finally {
                telemetry.recordSsmCreateDocument()
            }
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.deleteDocument', async (node: DocumentItemNodeWriteable) => {
            await deleteDocument(node)
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.executeDocument', async (node: DocumentItemNode) => {
            await executeDocument(node)
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.openLocalDocument', async (node: DocumentItemNode) => {
            await openDocumentItem(node, awsContext)
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.openLocalDocumentJson', async (node: DocumentItemNode) => {
            await openDocumentItemJson(node, awsContext)
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.openLocalDocumentYaml', async (node: DocumentItemNode) => {
            await openDocumentItemYaml(node, awsContext)
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('aws.ssmDocument.publishDocument', async () => {
            await publishSSMDocument(awsContext, regionProvider, outputChannel)
        })
    )

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand(
            'aws.ssmDocument.updateDocumentVersion',
            async (node: DocumentItemNodeWriteable) => {
                await updateDocumentVersion(node, awsContext)
            }
        )
    )
}