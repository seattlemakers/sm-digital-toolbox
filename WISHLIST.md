# Wishlist

## 1. Short summaries

Right now our only options for an event summary are WordPress' automatic one,
which cuts sentences in half and runs headings into the paragraph after them, or
the full blob of body text. The Excerpt field gives us one or two tasteful
sentences per class instead. 68 of the 100 entries on the calendar already have
one, so this is topping up rather than starting from scratch.

[Ceramics Wheel](https://seattlemakers.org/events/ceramics-wheel-4-part-series-13/)
is the model, though it runs a little long at three sentences and 237
characters:

> Get hands-on with clay in this four-session beginner series! You'll learn the
> foundations of wheel throwing and how the full ceramic process works,
> including glazing and firing. Leave with a beautiful finished piece, hand
> crafted by you.

Two sentences and around 150 characters is the target:

> Get hands-on with clay in this four-session beginner series! You'll learn
> wheel throwing and the whole ceramic process, from glazing to firing.

The field shows up in four places. The most visible is the List view on the
[Event Calendar](https://seattlemakers.org/events/), where an event with no
excerpt prints its entire body instead, which is where the 2,142-character
entries come from. It also fills link previews in Slack, iMessage and Facebook,
the events RSS feed, and the board in the space. It does not appear in the
Calendar view, which shows titles, times and availability only.

Write it in the Excerpt box rather than Yoast's SEO or Facebook description.
Those two only reach link previews, and the Excerpt is a core WordPress field
that survives a change of SEO plugin.

## 2. Updates to studio tags

We would like the studio tags standardized so that every class can be associated
with the studio it happens in. Today 39 of 166 events have no studio tag at all,
metalworking and the a/v studio have no tag that maps to them, and two studios
appear under two names each: `cnc` and `cnc-routing`, `leatherworking` and
`leatherworking-sewing`. Some tags do not match what the space calls the room
either, since `woodworking` is the woodshop and `print-making` is screen
printing.

The topical tags are useful and should stay. Design has 7 events, crafts 6,
cosplay 4, workshop 4, seasonal 3 and wheel 1. All we need is for the studio tag
to be separate from those and reliable.

## 3. Locations on events

Adding the studio or room to each event would let the screens give people
directions. Where a location is set today it is the building's street address,
3012 16th Ave W, written seven different ways, and 109 of the 166 entries carry
no venue line at all. A street address cannot tell somebody standing in the
lobby which way to walk.

This overlaps with the studio tags above. If those become reliable we can map
each studio to a location ourselves, so either ask gets us there.

## 4. Featured images

Every event should have a photograph of the class as its thumbnail. All 100
entries on the calendar do show an image, so nothing is missing outright, but
they come from only 32 distinct files and several are logos rather than
photographs. `laser_logo.jpg` appears 11 times and `tour_icon` 5, and the most
reused actual photograph, `screenprinting-300x284.jpg`, is on 14 entries. Our
market slideshow already drops the logo tiles and falls back to a studio icon,
so a real photo per class is what would change what people see.

## 5. Studio tags that match the studio archives

`seattlemakers.org/events/types/<slug>/` works and is what the printed studio
calendars point their QR codes at, so each sheet sends people to that studio's
own events. Two things stop it working everywhere, and both are really item 2
above showing up somewhere new.

Metalworking and the a/v studio have no tag, so there is no archive for them -
`/events/types/metalworking/` returns an empty page - and their sheets have to
fall back to the whole calendar. This is worth knowing about generally: an
unknown tag does not 404, it returns a normal-looking page with nothing on it,
so a wrong or retired tag fails silently rather than loudly.

CNC is split over two tags, and neither archive shows all of it. `cnc` has the
certification series and `cnc-routing` has that plus the Big CNC certifications.
Asking for both in one URL does not work - it quietly uses the first and drops
the rest - so the sheets point at `cnc-routing` because it happens to be the
larger of the two. Leatherworking is split the same way, though today both of
its tags land on the same single event.

One tag per studio, matching the room's name, would fix the door signs and a
good deal else besides.

## 6. Series sessions that stop showing up on the website's own calendar

A multi-part class is one entry on the calendar, and the calendar grid draws it
once per session, on each day that session runs. That is how the board and the
printed sheets know a four-part series is on four different evenings, and it
works: "CNC Certification Series (3 part series)" correctly shows on Wednesday
23, Monday 28 and Wednesday 30 September, which is exactly what its own
description says.

For four series it stops part-way through, and always at the same place -
where the series runs past the end of the month it started in:

| series | runs | drawn on the calendar |
| --- | --- | --- |
| Ceramics Wheel (4 Part Series) | Sep 21 - Oct 12 | Sep 21, Sep 28 |
| Clay Teapots - Beyond the Basics | Oct 14 - Nov 11 | Oct 14, Oct 21 |
| Ceramics Wheel (4 Part Series) | Oct 19 - Nov 9 | Oct 19, Oct 26 |
| Ceramics Wheel (4 Part Series) | Nov 16 - Dec 7 | Nov 16, Nov 23, Nov 30 |

The October page genuinely has nothing on 5 or 12 October for the first of
those, even though the event's own page lists "October 5 @ 7-9 pm" and
"October 12 @ 7-9 pm" in its description, and its dates say it runs until 9pm
on 12 October. So the sessions exist and are advertised; the calendar just
does not draw them.

**What that costs us:** those evenings are missing from the wall board and from
the studio's printed sheet. Somebody standing in front of the ceramics room on
5 October is told nothing is on, while a four-part class is running in it.

This one is a question for whoever administers the calendar plugin rather than
something we can fix - we read what the page draws, deliberately, because
guessing the dates instead gets them wrong. Weekly arithmetic off the start and
end dates would have put the CNC series on the wrong days, and the descriptions
that do list the dates are written five different ways and are not always right
either ("Sunday, October 5" on the weekend woodshop series is a Monday).
