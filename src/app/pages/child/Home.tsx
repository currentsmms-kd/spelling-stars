import { AppShell } from "src/app/components/AppShell";
import { Card } from "src/app/components/Card";
import { Button } from "src/app/components/Button";
import { Link } from "react-router-dom";
import { Headphones, Mic } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "src/app/supabase";

export function ChildHome() {
  const { data: lists } = useQuery({
    queryKey: ["child-lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spelling_lists")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell title="SpellStars" variant="child">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-primary-700 mb-4">
            Ready to practice spelling?
          </h2>
          <p className="text-2xl text-gray-600">Choose a game to play!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card variant="child">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto">
                <Headphones className="text-primary-700" size={48} />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">
                  Listen & Type
                </h3>
                <p className="text-xl text-gray-600">
                  Hear the word and type it out
                </p>
              </div>
              <Link to="/child/play/listen-type" className="block">
                <Button size="child" className="w-full">
                  Play
                </Button>
              </Link>
            </div>
          </Card>

          <Card variant="child">
            <div className="text-center space-y-6">
              <div className="w-24 h-24 bg-secondary-100 rounded-full flex items-center justify-center mx-auto">
                <Mic className="text-secondary-700" size={48} />
              </div>
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-2">
                  Say & Spell
                </h3>
                <p className="text-xl text-gray-600">
                  Say the spelling out loud
                </p>
              </div>
              <Link to="/child/play/say-spell" className="block">
                <Button size="child" className="w-full">
                  Play
                </Button>
              </Link>
            </div>
          </Card>
        </div>

        {lists && lists.length > 0 && (
          <Card variant="child">
            <h3 className="text-2xl font-bold mb-4">Available Lists</h3>
            <div className="space-y-3">
              {lists.map((list) => (
                <div key={list.id} className="p-4 bg-gray-50 rounded-xl border">
                  <p className="text-xl font-semibold">{list.title}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
