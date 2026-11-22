<script lang="ts">
	import { lineColor, type Mode } from '$lib/data';

	let { name, mode, size = 'm' }: { name: string; mode: Mode; size?: 's' | 'm' | 'l' } = $props();
	const c = $derived(lineColor(name, mode));
</script>

<span class="badge {size}" class:round={mode === 'metro' || mode === 'funicolare'} style:background={c.bg} style:color={c.fg}>
	{name}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		height: 28px;
		padding: 0 8px;
		border-radius: 6px;
		font-weight: 800;
		font-size: 0.9375rem;
		letter-spacing: 0.01em;
		flex: none;
	}
	.badge.round {
		border-radius: 14px;
	}
	.s {
		min-width: 32px;
		height: 22px;
		font-size: 0.8125rem;
		border-radius: 5px;
	}
	.s.round {
		border-radius: 11px;
	}
	.l {
		min-width: 56px;
		height: 40px;
		font-size: 1.375rem;
		border-radius: 8px;
	}
	.l.round {
		border-radius: 20px;
	}
</style>
