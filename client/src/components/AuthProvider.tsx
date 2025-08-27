import { useState, useEffect, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { getUser, createUser } from "@/lib/firestore";
import type { User } from "@shared/types";

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      
      // Check if user exists in Firestore
      let userData = await getUser(firebaseUser.uid);
      
      if (!userData) {
        // Create new user in Firestore
        userData = await createUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          firstName: firebaseUser.displayName?.split(" ")[0] || null,
          lastName: firebaseUser.displayName?.split(" ").slice(1).join(" ") || null,
          profileImageUrl: firebaseUser.photoURL || null,
          role: "student", // Default role
        });
      }
      
      setUser(userData);
      setFirebaseUser(firebaseUser);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;
      
      let userData = await getUser(firebaseUser.uid);
      
      if (!userData) {
        userData = await createUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || "",
          firstName: firebaseUser.displayName?.split(" ")[0] || null,
          lastName: firebaseUser.displayName?.split(" ").slice(1).join(" ") || null,
          profileImageUrl: firebaseUser.photoURL || null,
          role: "student",
        });
      }
      
      setUser(userData);
      setFirebaseUser(firebaseUser);
    } catch (error) {
      console.error("Error signing in with email:", error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = result.user;
      
      // Update Firebase user profile
      await updateProfile(firebaseUser, {
        displayName: `${firstName} ${lastName}`.trim(),
      });
      
      // Create user in Firestore
      const userData = await createUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        firstName,
        lastName,
        profileImageUrl: firebaseUser.photoURL || null,
        role: "student",
      });
      
      setUser(userData);
      setFirebaseUser(firebaseUser);
    } catch (error) {
      console.error("Error signing up with email:", error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      
      if (firebaseUser) {
        try {
          let userData = await getUser(firebaseUser.uid);
          
          if (!userData) {
            // Create new user if doesn't exist
            userData = await createUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || "",
              firstName: firebaseUser.displayName?.split(" ")[0] || null,
              lastName: firebaseUser.displayName?.split(" ").slice(1).join(" ") || null,
              profileImageUrl: firebaseUser.photoURL || null,
              role: "student",
            });
          }
          
          setUser(userData);
          setFirebaseUser(firebaseUser);
        } catch (error) {
          console.error("Error fetching user data:", error);
          setUser(null);
          setFirebaseUser(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    user,
    firebaseUser,
    isLoading,
    isAuthenticated: !!user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};