/**
 * How many medicines one search may cover.
 *
 * Its own module because both the API route and the client need it, and
 * importing it from the route would pull a server handler into the browser
 * bundle. Six is a long prescription; past that the list stops being a
 * shopping trip and the coverage answer stops being useful.
 */
export const MAX_DRUGS = 6
