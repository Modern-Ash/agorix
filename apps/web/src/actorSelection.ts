export function selectProjectActor(
  actors: readonly { readonly id: string }[] | undefined,
  preferredId: string | undefined,
): string {
  return actors?.some((actor) => actor.id === preferredId)
    ? preferredId!
    : (actors?.[0]?.id ?? "actor:main");
}
