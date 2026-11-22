<script lang="ts">
	import { B, type NewsItem } from '$lib/data';
	import LineBadge from './LineBadge.svelte';
	import type { RouteIdx } from '$lib/data';

	let { item, routes, open = false }: { item: NewsItem; routes: Map<string, RouteIdx>; open?: boolean } = $props();

	const KIND = { strike: 'Sciopero', closure: 'Chiusura', change: 'Variazione', info: 'Info' } as const;
	const date = $derived(
		item.date
			? new Date(item.date + 'T00:00:00Z').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
			: ''
	);
</script>

<article class="n {item.kind}" id={item.id}>
	<details {open}>
		<summary>
			<span class="meta"><span class="k">{KIND[item.kind]}</span> <span class="muted">{date}</span></span>
			<span class="title-m">{item.title}</span>
			{#if item.summary}<span class="muted body sum">{item.summary}</span>{/if}
		</summary>
		<div class="bodytxt body">
			{#if item.body}
				<!-- HTML sanitizzato in fase di build (scripts/sources) -->
				{@html item.body}
			{:else if item.summary}
				<p>{item.summary}</p>
			{/if}
			<p class="src"><a href={item.url} target="_blank" rel="noopener noreferrer">Vedi la notizia sul sito originale ↗</a></p>
		</div>
	</details>
	{#if item.lines.length}
		<div class="lines">
			{#each item.lines as l (l)}
				{@const r = routes.get(l)}
				{#if r}
					<a href="{B()}/linea/{r.id}" aria-label="Linea {l}"><LineBadge name={l} mode={r.mode} size="s" /></a>
				{/if}
			{/each}
		</div>
	{/if}
</article>

<style>
	.n {
		background: var(--surface-container-low);
		border-radius: var(--r-lg);
		padding: 14px 16px;
		border-left: 6px solid var(--outline-variant);
	}
	.n.strike {
		border-left-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 9%, var(--surface));
	}
	.n.closure {
		border-left-color: var(--error);
	}
	.n.change {
		border-left-color: #e0a100;
	}
	summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
		cursor: pointer;
		list-style: none;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.meta {
		font-size: 0.75rem;
		display: flex;
		gap: 8px;
		align-items: baseline;
	}
	.k {
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.sum {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	details[open] .sum {
		display: none;
	}
	.bodytxt {
		margin-top: 10px;
		overflow-wrap: anywhere;
	}
	.bodytxt :global(p) {
		margin: 0 0 8px;
	}
	.bodytxt :global(a),
	.src a {
		color: var(--primary);
		font-weight: 700;
	}
	.lines {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		margin-top: 10px;
	}
</style>
