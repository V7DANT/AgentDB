/**
 * Identifier of the specialized expert that produced a recommendation.
 *
 * The experts themselves are not implemented. Only the identifier is part of
 * the domain model, because it is recorded on every optimization and every
 * history entry — the backend stores which expert proposed a change so its
 * accuracy can be evaluated once the models exist.
 */
export type ExpertId = 'query-planner' | 'index' | 'configuration';
