/*!
 * Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { SSM } from 'aws-sdk'

import * as assert from 'assert'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { SsmDocumentClient } from '../../../shared/clients/ssmDocumentClient'
import { ToolkitClientBuilder } from '../../../shared/clients/toolkitClientBuilder'
import { ext } from '../../../shared/extensionGlobals'
import * as publish from '../../../ssmDocument/commands/publishDocument'
import * as ssmUtils from '../../../ssmDocument/util/util'
import {
    PublishSSMDocumentWizardResponse,
    PublishSSMDocumentWizard,
} from '../../../ssmDocument/wizards/publishDocumentWizard'
import { MockSsmDocumentClient } from '../../shared/clients/mockClients'
import * as picker from '../../../shared/ui/picker'
import { FakeAwsContext, FakeRegionProvider } from '../../utilities/fakeAwsContext'
import { anything, mock, instance, when, capture, verify } from '../../utilities/mockito'

let sandbox: sinon.SinonSandbox

const mockUriOne: vscode.Uri = {
    authority: 'MockAuthorityOne',
    fragment: 'MockFragmentOne',
    fsPath: 'MockFSPathOne',
    query: 'MockQueryOne',
    path: 'MockPathOne',
    scheme: 'MockSchemeOne',
    with: () => {
        return mockUriOne
    },
    toJSON: sinon.spy(),
}

const mockDoc: vscode.TextDocument = {
    eol: 1,
    fileName: 'MockFileNameOne',
    isClosed: false,
    isDirty: false,
    isUntitled: false,
    languageId: 'ssm-json',
    lineCount: 0,
    uri: mockUriOne,
    version: 0,
    getText: () => {
        return 'MockDocumentTextOne'
    },
    getWordRangeAtPosition: sinon.spy(),
    lineAt: sinon.spy(),
    offsetAt: sinon.spy(),
    positionAt: sinon.spy(),
    save: sinon.spy(),
    validatePosition: sinon.spy(),
    validateRange: sinon.spy(),
}

describe('publishSSMDocument', async () => {
    let sandbox = sinon.createSandbox()
    const fakeAwsContext = new FakeAwsContext()
    const fakeRegionProvider = new FakeRegionProvider()

    const fakeRegions = [
        {
            label: 'us-east-1',
            description: 'us-east-1',
        },
    ]

    const fakeRegion = {
        label: 'us-east-1',
        description: 'us-east-1',
    }

    let textDocument: vscode.TextDocument
    let apiCalled: string

    beforeEach(async () => {
        sandbox = sinon.createSandbox()
        apiCalled = ''
        textDocument = { ...mockDoc }
        sandbox.stub(vscode.window, 'activeTextEditor').value({
            document: textDocument,
        })
        sandbox
            .stub(picker, 'promptUser')
            .onFirstCall()
            .returns(Promise.resolve(fakeRegions))
        sandbox
            .stub(picker, 'verifySinglePickerOutput')
            .onFirstCall()
            .returns(fakeRegion)
        initializeClientBuilders()
    })

    afterEach(async () => {
        sandbox.restore()
    })

    it('tests calling createDocument', async () => {
        const wizardStub = sandbox.stub(PublishSSMDocumentWizard.prototype, 'run').returns(
            Promise.resolve({
                PublishSsmDocAction: 'Create',
                name: 'testName',
                documentType: 'Command',
            })
        )

        await publish.publishSSMDocument(fakeAwsContext, fakeRegionProvider)

        sinon.assert.calledOnce(wizardStub)
        assert.strictEqual(apiCalled, 'createDocument')
    })

    it('tests calling updateDocument', async () => {
        const wizardStub = sandbox.stub(PublishSSMDocumentWizard.prototype, 'run').returns(
            Promise.resolve({
                PublishSsmDocAction: 'Update',
                name: 'testName',
            })
        )
        sandbox.stub(ssmUtils, 'showConfirmationMessage').returns(Promise.resolve(false))
        await publish.publishSSMDocument(fakeAwsContext, fakeRegionProvider)

        sinon.assert.calledOnce(wizardStub)
        assert.strictEqual(apiCalled, 'updateDocument')
    })

    function initializeClientBuilders(): void {
        const ssmDocumentClient = {
            createDocument: (request: SSM.CreateDocumentRequest) => {
                apiCalled = 'createDocument'
                return {} as SSM.CreateDocumentResult
            },
            updateDocument: (request: SSM.UpdateDocumentRequest) => {
                apiCalled = 'updateDocument'
                return {} as SSM.UpdateDocumentResult
            },
        }

        const clientBuilder = {
            createSsmClient: sandbox.stub().returns(ssmDocumentClient),
        }

        ext.toolkitClientBuilder = (clientBuilder as any) as ToolkitClientBuilder
    }
})

describe('publishDocument', async () => {
    let wizardResponse: PublishSSMDocumentWizardResponse
    let textDocument: vscode.TextDocument
    let result: SSM.CreateDocumentResult | SSM.UpdateDocumentResult
    let client: SsmDocumentClient
    let channelOutput: string[] = []

    beforeEach(async () => {
        sandbox = sinon.createSandbox()
        channelOutput = []

        wizardResponse = {
            PublishSsmDocAction: 'Update',
            name: 'test',
            documentType: 'Automation',
        }
        textDocument = { ...mockDoc }
        result = {
            DocumentDescription: {
                Name: 'testName',
            },
        }
    })

    afterEach(() => {
        sandbox.restore()
    })

    describe('createDocument', async () => {
        it('createDocument API returns successfully', async () => {
            client = mock()
            when(client.createDocument(anything())).thenResolve()
            await publish.createDocument(wizardResponse, textDocument, 'us-east-1', client)
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const [createDocumentRequest] = capture(client.createDocument).last()
            assert.strictEqual(createDocumentRequest.Name, 'test')
            assert.strictEqual(createDocumentRequest.DocumentType, 'Automation')
        })

        it('createDocument API failed', async () => {
            client = new MockSsmDocumentClient(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                req => {
                    return new Promise<SSM.CreateDocumentResult>((resolve, reject) => {
                        throw new Error('Create Error')
                    })
                },
                undefined,
                undefined
            )

            await publish.createDocument(wizardResponse, textDocument, 'us-east-1', client)
        })
    })

    describe('updateDocument', async () => {
        it('updateDocument API returns successfully', async () => {
            client = new MockSsmDocumentClient(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                req => {
                    return new Promise<SSM.UpdateDocumentResult>((resolve, reject) => {
                        resolve(result)
                    })
                }
            )
            sandbox.stub(ssmUtils, 'showConfirmationMessage').returns(Promise.resolve(false))
            // const window = new FakeWindow({ message: { warningSelection: 'No' } })
            await publish.updateDocument(wizardResponse, textDocument, 'us-east-1', client)
        })

        it('updateDocument API failed', async () => {
            client = new MockSsmDocumentClient(
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                req => {
                    return new Promise<SSM.UpdateDocumentResult>((resolve, reject) => {
                        throw new Error('Update Error')
                    })
                }
            )
            sandbox.stub(ssmUtils, 'showConfirmationMessage').returns(Promise.resolve(false))
            await publish.updateDocument(wizardResponse, textDocument, 'us-east-1', client)
        })
    })
})
