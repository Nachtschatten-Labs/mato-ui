import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/welcome')({
  beforeLoad: ({ location }) => {
    throw redirect({
      to: '/',
      search: {},
      hash: location.hash,
      statusCode: 301,
      replace: true,
    })
  },
})
