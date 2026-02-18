interface User {
    id: string;
    email: string;
    name: string;
    password: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    subscription: 'Free' | 'Pro';
}

interface PublicUser {
    name: string;
    email: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    subscription: 'Free' | 'Pro';
}

interface LoginCredentials {
    email: string;
    password: string;
}

interface SignupData {
    name: string;
    email: string;
    password: string;
}

class AuthService {
    private getUsersFromStorage(): User[] {
        const users = localStorage.getItem('users');
        return users ? JSON.parse(users) : [];
    }

    private saveUsersToStorage(users: User[]): void {
        localStorage.setItem('users', JSON.stringify(users));
    }

    private generateUserId(): string {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private toPublicUser(user: User): PublicUser {
        return {
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
            subscription: user.subscription
        };
    }

    async login(credentials: LoginCredentials): Promise<PublicUser> {
        const email = credentials.email.toLowerCase().trim();
        const password = credentials.password;

        const users = this.getUsersFromStorage();
        const user = users.find(u => u.email === email);

        if (!user) {
            throw new Error('Account not found');
        }

        if (user.password !== password) {
            throw new Error('Invalid password');
        }

        const publicUser = this.toPublicUser(user);
        localStorage.setItem('authUser', JSON.stringify(publicUser));
        return publicUser;
    }

    async signup(data: SignupData): Promise<PublicUser> {
        const email = data.email.toLowerCase().trim();
        const name = data.name.trim();
        const password = data.password;

        const users = this.getUsersFromStorage();

        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            throw new Error('Account already exists');
        }

        const newUser: User = {
            id: this.generateUserId(),
            email,
            name,
            password,
            role: 'USER',
            createdAt: new Date().toISOString(),
            subscription: 'Free'
        };

        users.push(newUser);
        this.saveUsersToStorage(users);

        const publicUser = this.toPublicUser(newUser);
        localStorage.setItem('authUser', JSON.stringify(publicUser));
        return publicUser;
    }

    async logout(): Promise<void> {
        localStorage.removeItem('authUser');
    }

    getCurrentUser(): PublicUser | null {
        const user = localStorage.getItem('authUser');
        return user ? JSON.parse(user) : null;
    }

    async updateProfile(data: Partial<PublicUser>): Promise<PublicUser> {
        const currentUser = this.getCurrentUser();
        if (!currentUser) {
            throw new Error('No user logged in');
        }

        const updatedUser = { ...currentUser, ...data };
        localStorage.setItem('authUser', JSON.stringify(updatedUser));
        return updatedUser;
    }

    async changePassword(_oldPassword: string, _newPassword: string): Promise<void> {
        throw new Error('Password change not implemented yet');
    }
}

export const authService = new AuthService();
