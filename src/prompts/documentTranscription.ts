export const documentTranscription = (
  filename?: string
) => `The following message contains the description of a document sent by the user and processed by our system beforehand.
Use this document content to answer questions or provide relevant insights about the file.
${filename ? `The name of the document is: ${filename}` : ''}
`
