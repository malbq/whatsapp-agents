const transformUsageTokens = (data: any): { data: any; transformed: boolean } => {
  if (
    data.usage &&
    typeof data.usage === 'object' &&
    'prompt_tokens' in data.usage &&
    'completion_tokens' in data.usage
  ) {
    data.usage.input_tokens = data.usage.prompt_tokens
    data.usage.output_tokens = data.usage.completion_tokens
    delete data.usage.prompt_tokens
    delete data.usage.completion_tokens
    return { data, transformed: true }
  }
  return { data, transformed: false }
}

export function createCloudflareCompatibleFetch(originalFetch: typeof fetch) {
  const customFetch = async (
    url: URL | Request | string,
    init?: RequestInit
  ): Promise<Response> => {
    const response = await originalFetch(url as any, init)

    if (!response.ok) {
      return response
    }

    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('text/event-stream')) {
      const originalBody = response.body
      if (!originalBody) return response

      const transformedStream = new TransformStream({
        transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk)
          const lines = text.split('\n')
          const transformedLines = lines.map((line) => {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const jsonStr = line.slice(6)
                const data = JSON.parse(jsonStr)
                const { data: transformed } = transformUsageTokens(data)
                return `data: ${JSON.stringify(transformed)}`
              } catch {
                return line
              }
            }
            return line
          })
          controller.enqueue(new TextEncoder().encode(transformedLines.join('\n')))
        },
      })

      return new Response(originalBody.pipeThrough(transformedStream), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    if (contentType.includes('application/json')) {
      const clonedResponse = response.clone()
      try {
        const data = (await clonedResponse.json()) as any
        const { data: transformedData, transformed } = transformUsageTokens(data)

        if (transformed) {
          return new Response(JSON.stringify(transformedData), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          })
        }
      } catch {
        return response
      }
    }

    return response
  }

  return customFetch as typeof fetch
}
