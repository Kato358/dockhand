<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { AlertTriangle, Loader2, Trash2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		/** How many snapshots the confirm will delete. */
		count: number;
		/** Deletion in progress (disables the button, shows a spinner). */
		busy?: boolean;
		onConfirm: () => void;
	}
	let { open = $bindable(), count, busy = false, onConfirm }: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2 text-destructive">
				<AlertTriangle class="h-5 w-5" />
				Delete {count} snapshot{count === 1 ? '' : 's'}?
			</Dialog.Title>
		</Dialog.Header>
		<p class="text-sm text-muted-foreground">
			This permanently forgets and prunes the selected snapshot{count === 1 ? '' : 's'} from
			{count === 1 ? 'its' : 'their'} backup repository. This cannot be undone.
		</p>
		<Dialog.Footer class="gap-2 sm:justify-end">
			<Button variant="outline" onclick={() => (open = false)} disabled={busy}>取消</Button>
			<Button variant="destructive" onclick={onConfirm} disabled={busy}>
				{#if busy}<Loader2 class="mr-1 h-4 w-4 animate-spin" />{:else}<Trash2 class="mr-1 h-4 w-4" />{/if}
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
