"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATS: { name: string; emojis: string }[] = [
  { name: "Smileys & people", emojis: "😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😋😛😜🤪😝🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬😮‍💨🤥😌😔😪😴😷🤒🤕🤢🤮🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈💀💩🤡👻👽🤖👋🤚✋🖖👌🤌🤏✌️🤞🤟🤘🤙👈👉👆👇☝️👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏💪🧠👀" },
  { name: "Animals & nature", emojis: "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐢🐍🦖🐙🦑🦀🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🐘🦛🦏🐪🦒🦘🌵🎄🌲🌳🌴🌱🌿☘️🍀🍁🍂🍃🌷🌹🥀🌺🌸🌼🌻🌞🌝🌚🌙⭐🌟✨⚡🔥🌈☀️⛅☁️🌧️⛈️❄️☃️🌊💧" },
  { name: "Food & drink", emojis: "🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🥑🥦🌽🥕🥔🥐🥖🥨🧀🥚🍳🥞🧇🥓🍔🍟🍕🌭🥪🌮🌯🥗🍝🍜🍲🍣🍱🍤🍙🍚🍦🍩🍪🎂🍰🧁🍫🍬🍭🍯☕🍵🧃🥤🍺🍻🥂🍷🍸🍹🧉" },
  { name: "Activity", emojis: "⚽🏀🏈⚾🎾🏐🏉🎱🏓🏸🏒⛳🏹🎣🥊🥋🎽⛸️🛹🏂🏋️🤸⛹️🤺🏌️🏇🧘🏄🏊🚣🧗🚴🏆🥇🥈🥉🏅🎖️🎗️🎫🎟️🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🎻🎲♟️🎯🎳🎮🧩" },
  { name: "Travel & places", emojis: "🚗🚕🚙🚌🏎️🚓🚑🚒🚐🚚🚜🛴🚲🛵🏍️✈️🛫🛬🚀🛸🚁⛵🚤🛳️🚢⚓🗺️🗿🗽🗼🏰🏯🏟️🎡🎢🎠⛲⛱️🏖️🏝️🏜️🌋⛰️🏔️🗻🏕️🏠🏡🏢🏬🏭🏗️🌁🌃🌆🌇🌉" },
  { name: "Objects", emojis: "⌚📱💻⌨️🖥️🖨️🖱️💾💿📷📹🎥📞☎️📺📻🎙️⏱️⏰⌛⏳📡🔋🔌💡🔦🕯️🧯💸💵💰💳💎⚖️🧰🔧🔨⚒️🛠️⛏️🔩⚙️🧱⛓️🧲🔫💣🧨🔪🛡️🚬⚰️🔮📿🧿💈⚗️🔭🔬🩺💊💉🧬🦠🧪🌡️🧹🧺🧻🚽🛁🔑🗝️🚪🛋️🛏️🧸🖼️🛍️🎁🎈🎏🎀🎊🎉✉️📩📦📫📮📜📃📄📊📈📉📆📅🗓️📇📋📁📂🗂️📰📓📔📒📕📗📘📙📚📖🔖🔗📎🖇️📐📏📌📍✂️🖊️🖋️✒️🖌️🖍️📝✏️🔍🔎🔒🔓" },
  { name: "Symbols", emojis: "❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮️✝️☯️🛐⛎♈♉♊♋♌♍♎♏♐♑♒♓🆔⚛️🉑☢️☣️📴📳🈶🈚🆚💮🉐㊙️㊗️🅰️🅱️🆎🆑🅾️🆘❌⭕🛑⛔📛🚫💯💢♨️🚷🚯🚳🚱🔞📵🚭❗❕❓❔‼️⁉️🔅🔆〽️⚠️🚸🔱⚜️🔰♻️✅🈯💹❇️✳️❎🌐💠Ⓜ️🌀💤🏧🚾♿🅿️🛗🈳🈂️🛂🛃🛄🛅🚹🚺🚼⚧🚻🚮🎦📶🈁🔣ℹ️🔤🔡🔠🆖🆗🆙🆒🆕🆓0️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣9️⃣🔟🔢#️⃣*️⃣⏏️▶️⏸️⏯️⏹️⏺️⏭️⏮️⏩⏪⏫⏬◀️🔼🔽➡️⬅️⬆️⬇️↗️↘️↙️↖️↕️↔️↪️↩️⤴️⤵️🔀🔁🔂🔄🔃🎵🎶➕➖➗✖️♾️💲💱™️©️®️〰️➰➿🔚🔙🔛🔝🔜✔️☑️🔘🔴🟠🟡🟢🔵🟣⚫⚪🟤🔺🔻🔸🔹🔶🔷🔳🔲▪️▫️◾◽◼️◻️🟥🟧🟨🟩🟦🟪⬛⬜🟫🔈🔇🔉🔊🔔🔕📣📢💬💭🗯️♠️♣️♥️♦️🃏🎴🀄" },
  { name: "Flags", emojis: "🏁🚩🎌🏴🏳️🏳️‍🌈🏴‍☠️🇺🇸🇬🇧🇨🇦🇦🇺🇳🇿🇮🇪🇩🇪🇫🇷🇪🇸🇮🇹🇳🇱🇧🇪🇨🇭🇸🇪🇳🇴🇩🇰🇫🇮🇵🇱🇵🇹🇧🇷🇦🇷🇲🇽🇯🇵🇰🇷🇨🇳🇮🇳🇸🇬🇿🇦🇳🇬🇰🇪🇪🇬🇮🇱🇹🇷🇺🇦" },
];

const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;
const split = (s: string) => (seg ? [...seg.segment(s)].map((x) => x.segment) : Array.from(s));
const ALL = CATS.map((c) => ({ name: c.name, list: split(c.emojis) }));

export function EmojiPicker({ onPick, trigger, className, align = "start" }: { onPick: (e: string) => void; trigger?: React.ReactNode; className?: string; align?: "start" | "end" | "center" }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button type="button" className={cn("inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground", className)} aria-label="Insert emoji">
            <SmilePlus className="size-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-80 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="mb-2 h-8" />
        <div className="h-64 overflow-y-auto pr-1">
          {ALL.map((c) =>
            q && !c.name.toLowerCase().includes(q.toLowerCase()) ? null : (
              <div key={c.name} className="mb-2">
                <p className="sticky top-0 bg-popover py-1 text-[11px] font-medium text-muted-foreground">{c.name}</p>
                <div className="grid grid-cols-9 gap-0.5">
                  {c.list.map((e, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        onPick(e);
                        setOpen(false);
                      }}
                      className="flex size-8 items-center justify-center rounded-md text-xl hover:bg-muted"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
