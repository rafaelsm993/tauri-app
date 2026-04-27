import type { User } from '$lib/types/media';

class UserStore {
  currentUser = $state<User | null>(null);
  isLoggedIn = $derived(this.currentUser !== null);

  login(user: User) {
    this.currentUser = user;
  }

  logout() {
    this.currentUser = null;
  }
}

export const userStore = new UserStore();
