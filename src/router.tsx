import { getGlobalStartContext } from '@tanstack/react-start'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import * as TanstackQuery from './integrations/tanstack-query/root-provider'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
export const getRouter = () => {
  const rqContext = TanstackQuery.getContext()

  const serverContext: unknown = import.meta.env.SSR
    ? getGlobalStartContext()
    : undefined
  const nonce =
    serverContext &&
    typeof serverContext === 'object' &&
    'nonce' in serverContext &&
    typeof serverContext.nonce === 'string'
      ? serverContext.nonce
      : undefined

  const router = createRouter({
    ssr: { nonce },
    routeTree,
    context: {
      ...rqContext,
    },

    defaultPreload: 'intent',
  })

  setupRouterSsrQueryIntegration({ router, queryClient: rqContext.queryClient })

  return router
}
