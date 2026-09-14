<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { ToggleGroup } from '$lib/components/ui/toggle-pill';
	import { Key, KeyRound, Lock } from 'lucide-svelte';
	import { focusFirstInput } from '$lib/utils';

	// Auth type options with icons
	const authTypeOptions = [
		{ value: 'password', label: 'Password/Token', icon: Lock },
		{ value: 'ssh', label: 'SSH Key', icon: KeyRound }
	];

	interface GitCredential {
		id: number;
		name: string;
		authType: 'none' | 'password' | 'ssh';
		username?: string;
		hasPassword: boolean;
		hasSshKey: boolean;
	}

	interface Props {
		open: boolean;
		credential?: GitCredential | null;
		onClose: () => void;
		onSaved: () => void;
	}

	let { open = $bindable(), credential = null, onClose, onSaved }: Props = $props();

	// Form state
	let formName = $state('');
	let formAuthType = $state<'none' | 'password' | 'ssh'>('password');
	let formUsername = $state('');
	let formPassword = $state('');
	let formSshKey = $state('');
	let formSshPassphrase = $state('');
	let formError = $state('');
	let formSaving = $state(false);
	let errors = $state<{ name?: string; password?: string; sshKey?: string }>({});

	const isEditing = $derived(credential !== null);

	// Track which credential was initialized to avoid repeated resets
	let lastInitializedCredId = $state<number | null | undefined>(undefined);

	$effect(() => {
		if (open) {
			const currentCredId = credential?.id ?? null;
			if (lastInitializedCredId !== currentCredId) {
				lastInitializedCredId = currentCredId;
				resetForm();
			}
		} else {
			lastInitializedCredId = undefined;
		}
	});

	function resetForm() {
		if (credential) {
			formName = credential.name;
			formAuthType = credential.authType;
			formUsername = credential.username || '';
			formPassword = '';
			formSshKey = '';
			formSshPassphrase = '';
		} else {
			formName = '';
			formAuthType = 'password';
			formUsername = '';
			formPassword = '';
			formSshKey = '';
			formSshPassphrase = '';
		}
		formError = '';
		errors = {};
	}

	async function saveCredential() {
		errors = {};
		let hasErrors = false;

		if (!formName.trim()) {
			errors.name = 'Name is required';
			hasErrors = true;
		}

		if (formAuthType === 'password' && !formPassword.trim() && !credential?.hasPassword) {
			errors.password = 'Password is required';
			hasErrors = true;
		}

		if (formAuthType === 'ssh' && !formSshKey.trim() && !credential?.hasSshKey) {
			errors.sshKey = 'SSH private key is required';
			hasErrors = true;
		}

		if (hasErrors) return;

		formSaving = true;
		formError = '';

		try {
			const body: any = {
				name: formName.trim(),
				authType: formAuthType,
				username: formUsername.trim() || undefined
			};

			if (formAuthType === 'password') {
				body.password = formPassword;
			}

			if (formAuthType === 'ssh') {
				body.sshPrivateKey = formSshKey;
				if (formSshPassphrase) body.sshPassphrase = formSshPassphrase;
			}

			const url = credential
				? `/api/git/credentials/${credential.id}`
				: '/api/git/credentials';
			const method = credential ? 'PUT' : 'POST';

			const response = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (!response.ok) {
				formError = data.error || 'Failed to save credential';
				toast.error(formError);
				return;
			}

			onSaved();
			onClose();
			toast.success(credential ? 'Credential updated' : 'Credential created');
		} catch (error) {
			formError = 'Failed to save credential';
			toast.error('Failed to save credential');
		} finally {
			formSaving = false;
		}
	}

</script>

<Dialog.Root bind:open onOpenChange={(o) => { if (o) focusFirstInput(); else onClose(); }}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<Key class="w-5 h-5" />
				{isEditing ? '编辑' : 'Add'} Git credential
			</Dialog.Title>
			<Dialog.Description>
				{isEditing ? 'Update credential settings' : 'Create a new credential for accessing Git repositories'}
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={(e) => { e.preventDefault(); saveCredential(); }} class="space-y-4">
			<div class="space-y-2">
				<Label for="cred-name">Name</Label>
				<Input
					id="cred-name"
					bind:value={formName}
					placeholder="e.g., GitHub Personal"
					class={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
					oninput={() => errors.name = undefined}
				/>
				{#if errors.name}
					<p class="text-xs text-destructive">{errors.name}</p>
				{:else if !isEditing}
					<p class="text-xs text-muted-foreground">A friendly name to identify this credential</p>
				{/if}
			</div>

			<div class="space-y-2">
				<Label>Authentication type</Label>
				<ToggleGroup
					value={formAuthType}
					options={authTypeOptions}
					onchange={(val) => formAuthType = val as 'password' | 'ssh'}
				/>
			</div>

			<!-- Fixed height container to prevent layout jump -->
			<div class="min-h-[220px] space-y-4">
				{#if formAuthType === 'password'}
					<div class="space-y-2">
						<Label for="cred-username">Username</Label>
						<Input id="cred-username" bind:value={formUsername} placeholder="Username or email" />
					</div>
					<div class="space-y-2">
						<Label for="cred-password">Password or token</Label>
						<Input
							id="cred-password"
							type="password"
							bind:value={formPassword}
							placeholder={isEditing ? 'Leave empty to keep current' : 'Password or personal access token'}
							class={errors.password ? 'border-destructive focus-visible:ring-destructive' : ''}
							oninput={() => errors.password = undefined}
						/>
						{#if errors.password}
							<p class="text-xs text-destructive">{errors.password}</p>
						{:else if isEditing && credential?.hasPassword}
							<p class="text-xs text-muted-foreground">Current password is set. Leave empty to keep it.</p>
						{/if}
					</div>
				{:else if formAuthType === 'ssh'}
					<div class="space-y-2">
						<Label for="cred-ssh-key">SSH private key</Label>
						<textarea
							id="cred-ssh-key"
							bind:value={formSshKey}
							class="w-full h-32 px-3 py-2 text-sm border rounded-md font-mono bg-background {errors.sshKey ? 'border-destructive focus-visible:ring-destructive' : ''}"
							placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
							oninput={() => errors.sshKey = undefined}
						></textarea>
						{#if errors.sshKey}
							<p class="text-xs text-destructive">{errors.sshKey}</p>
						{:else if isEditing && credential?.hasSshKey}
							<p class="text-xs text-muted-foreground">Current SSH key is set. Leave empty to keep it.</p>
						{/if}
					</div>
					<div class="space-y-2">
						<Label for="cred-ssh-passphrase">SSH passphrase (optional)</Label>
						<Input id="cred-ssh-passphrase" type="password" bind:value={formSshPassphrase} placeholder="Passphrase for encrypted key" />
					</div>
				{/if}
			</div>

			{#if formError}
				<p class="text-sm text-destructive">{formError}</p>
			{/if}

			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={onClose}>取消</Button>
				<Button type="submit" disabled={formSaving}>
					{formSaving ? 'Saving...' : (isEditing ? 'Save changes' : 'Add credential')}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
