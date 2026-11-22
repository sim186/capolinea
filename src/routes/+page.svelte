<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$lib/paths';
	import Brand from '$lib/components/Brand.svelte';
	import { loadFeeds, type FeedCfg } from '$lib/data';

	let feeds = $state<FeedCfg[] | null>(null);
	loadFeeds().then((f) => {
		// una sola città: vai dritto
		if (f.length === 1) goto(`${base}/${f[0].id}`, { replaceState: true });
		else feeds = f;
	});
</script>

{#if feeds}
	<div class="page stack">
		<div class="logo"><Brand size={44} /></div>
		<h1 class="display">Capolinea</h1>
		<p class="body muted">Il trasporto pubblico italiano, senza fatica. Scegli la città.</p>
		<ul class="list">
			{#each feeds as f (f.id)}
				<li>
					<a href="{base}/{f.id}">
						<div class="grow">
							<div class="title-m">{f.name}</div>
							<div class="muted body">{f.operatorFull}</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.page {
		padding-bottom: 24px;
	}
</style>
