/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()

import { SSM } from 'aws-sdk'
import * as vscode from 'vscode'
import { AwsContext } from '../../shared/awsContext'
import { getLogger, Logger } from '../../shared/logger'
import * as telemetry from '../../shared/telemetry/telemetry'
import * as picker from '../../shared/ui/picker'
import { DocumentItemNodeWriteable } from '../explorer/documentItemNodeWriteable'

export async function updateDocumentVersion(node: DocumentItemNodeWriteable, awsContext: AwsContext, format?: string) {
    const logger: Logger = getLogger()

    let result: telemetry.Result = 'Succeeded'

    // Currently only JSON/YAML formats are supported
    try {
        if (node.documentOwner === awsContext.getCredentialAccountId()) {
            const versions = await node.listSchemaVersion()
            let documentVersion: string | undefined = await promptUserforDocumentVersion(versions)
            if (!documentVersion) {
                result = 'Cancelled'
            } else {
                await node.updateDocumentVersion(documentVersion)
                vscode.window.showInformationMessage(
                    localize(
                        'AWS.message.info.ssmDocument.updateDocumentVersion.success',
                        'Updated document {0} default version successfully',
                        node.documentName
                    )
                )
            }
        } else {
            result = 'Failed'
            vscode.window.showErrorMessage(
                localize(
                    'AWS.message.error.ssmDocument.updateDocumentVersion.does_not_own',
                    'Could not update document {0} default version. The current account does not have ownership of this document.',
                    node.documentName
                )
            )
        }
    } catch (err) {
        result = 'Failed'
        const error = err as Error
        vscode.window.showErrorMessage(
            localize(
                'AWS.message.error.ssmDocument.updateDocumentVersion.could_not_update_version',
                'Could not update document {0} default version. Please check logs for more details.',
                node.documentName
            )
        )
        logger.error('Error on updating document version: %0', error)
    } finally {
        telemetry.recordSsmUpdateDocumentVersion({ result: result })
    }
}

async function promptUserforDocumentVersion(versions: SSM.Types.DocumentVersionInfo[]): Promise<string | undefined> {
    // Prompt user to pick document version
    const quickPickItems: vscode.QuickPickItem[] = []
    versions.forEach(version => {
        if (version.DocumentVersion) {
            quickPickItems.push({
                label: version.DocumentVersion,
                description: `${version.IsDefaultVersion ? 'Default' : ''}`,
            })
        }
    })

    if (quickPickItems.length > 1) {
        const versionPick = picker.createQuickPick({
            options: {
                ignoreFocusOut: true,
                title: localize(
                    'AWS.message.prompt.selectSsmDocumentVersion.placeholder',
                    'Select a document version to download'
                ),
            },
            items: quickPickItems,
        })

        const versionChoices = await picker.promptUser({
            picker: versionPick,
        })

        const versionSelection = picker.verifySinglePickerOutput(versionChoices)

        // User pressed escape and didn't select a template
        return versionSelection?.label
    } else {
        vscode.window.showErrorMessage(
            localize(
                'AWS.message.error.ssmDocument.updateDocumentVersion.no_other_versions',
                'Selected document only has one version. Unable to change default version.'
            )
        )
        return undefined
    }
}
