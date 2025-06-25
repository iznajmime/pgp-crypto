import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "ok" | "error"
  >("connecting");
  const [profileCount, setProfileCount] = useState<number | null>(null);

  useEffect(() => {
    const checkSupabaseConnection = async () => {
      try {
        const { count, error } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true });

        if (error) {
          throw error;
        }
        setConnectionStatus("ok");
        setProfileCount(count);
      } catch (error) {
        console.error("Supabase connection error:", error);
        setConnectionStatus("error");
      }
    };

    checkSupabaseConnection();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-4">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Supabase Connection</CardTitle>
          </CardHeader>
          <CardContent>
            {connectionStatus === "connecting" && (
              <p>Checking connection...</p>
            )}
            {connectionStatus === "ok" && (
              <Alert variant="default" className="bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertTitle className="text-green-800 dark:text-green-200">Connected</AlertTitle>
                <AlertDescription className="text-green-700 dark:text-green-300">
                  Successfully connected to Supabase.
                  {profileCount !== null && ` Found ${profileCount} profiles.`}
                </AlertDescription>
              </Alert>
            )}
            {connectionStatus === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Connection Failed</AlertTitle>
                <AlertDescription>
                  Could not connect to Supabase. Please check console for errors.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
