"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { officeById } from "@/lib/offices";
import { OfficeCard } from "./OfficeCard";
import { PageHead, Tip } from "./fields";

function NeverKeeps({ found }: { found?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="font-bold">What {APP_NAME} never keeps</p>
      <p className="mt-1 text-[15px] text-muted">
        ID numbers, photos of IDs, card numbers, names or your U number.{" "}
        {found
          ? "Please don't take a photo of it or post it anywhere."
          : "If someone finds an ID, we tell them to hand it to the USF Card Center instead of posting it."}
      </p>
    </div>
  );
}

const sourceNote = (
  <p className="text-sm text-muted">Contact info from official usf.edu pages, checked Nov 2026. Re-check before the demo.</p>
);

/** V2 "Lost your USF ID?": no post at all, just who to call, in order. */
export function LostId() {
  const card = officeById("card")!;
  const upd = officeById("upd")!;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHead
        back={{ label: "Back to I lost something", href: "/lost" }}
        title="Lost your USF ID?"
        sub={`Go straight to the office below. We don't post IDs, so your information never goes on ${APP_NAME}.`}
      />
      <NeverKeeps />
      <section>
        <h2 className="mb-3 text-lg font-bold">Do this now, in order</h2>
        <ol className="space-y-3">
          <li>
            <OfficeCard office={card} step={1} why="Found USF IDs are turned in here, so check with them first." />
          </li>
          <li className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bull text-sm font-bold text-white">2</span>
              <div>
                <h3 className="text-lg font-bold leading-tight">Ask them to turn off the lost card</h3>
                <p className="mt-0.5 text-[15px] text-muted">
                  If it isn&apos;t there, ask the Card Center to deactivate it so no one else can use it to get into buildings or spend your
                  Bull Bucks, and get a new one.
                </p>
              </div>
            </div>
          </li>
          <li>
            <OfficeCard
              office={upd}
              step={3}
              why="Report it to USF Police if you think someone took it, or if your wallet with other IDs is missing too."
            />
          </li>
        </ol>
      </section>
      {sourceNote}
      <div className="rounded-2xl border border-line bg-white p-4 text-[15px]">
        <p className="font-bold">Lost another ID or card too?</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>Bank or credit card: call your bank or use its app to lock the card right away.</li>
          <li>Driver&apos;s license: request a replacement from the Florida DMV (FLHSMV).</li>
          <li>
            Something else of value in the same wallet? <Link href="/lost" className="link text-ink">Post it as a lost item</Link> without the IDs.
          </li>
        </ul>
      </div>
      <Link href="/" className="btn-ghost w-full">Back to home</Link>
    </div>
  );
}

/** V2 "Found an ID or card?": hand it in, don't post it. Nothing about the ID is saved. */
export function FoundId() {
  const card = officeById("card")!;
  const upd = officeById("upd")!;
  const [done, setDone] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHead
        back={{ label: "Back to I found something", href: "/found" }}
        title="Found an ID or card?"
        sub={`Hand it straight to the office below. ${APP_NAME} never posts or stores photos, names or numbers from IDs and cards, so the owner's information stays safe.`}
      />
      <NeverKeeps found />
      <Tip>
        <strong>Hand it in today.</strong> After office hours, USF Police takes any ID.
      </Tip>
      <section>
        <h2 className="text-lg font-bold">Where to take it</h2>
        <p className="mb-3 text-[15px] text-muted">USF ID? Card Center. Driver&apos;s license, bank card, or after hours? USF Police.</p>
        <div className="space-y-3">
          <OfficeCard office={card} why="USF ID cards go here. The owner can also get a replacement here." />
          <OfficeCard office={upd} why="Driver's licenses, credit and debit cards, and any ID found after hours." />
        </div>
      </section>
      {sourceNote}
      {done ? (
        <div className="pop-in rounded-2xl bg-bull p-4 text-white">
          <p className="text-lg font-bold">Thank you!</p>
          <p className="text-sm text-white/85">That&apos;s all. Nothing about the card was saved here, and the office will contact the owner.</p>
          <Link href="/" className="mt-3 inline-block font-semibold underline">Back to home</Link>
        </div>
      ) : (
        <button type="button" onClick={() => setDone(true)} className="btn-primary w-full text-lg">I turned it in</button>
      )}
    </div>
  );
}
