"""Image generation jobs for 喵斗羅. Each job -> one Codex image_generation call."""
import json

STYLE = ("Art style must match the attached reference art exactly: hand-drawn cartoon, thick slightly wobbly black ink outlines, "
         "grainy risograph / aged-paper texture inside the color fills, limited flat palette of coral red (#E8564B), mustard yellow (#F2B33D), "
         "grey-green (#7E9A8C), cream (#EFEADF) and black. ")
BG = ("Background: one plain flat solid pale cream color (#F6F3EC) filling the whole canvas and nothing else — no ground shadows, "
      "no text, no numbers, no labels, no frame borders, no grid lines. ")

def sheet(n, facing="RIGHT"):
    return (f"Layout: a game sprite sheet with exactly {n} frames in ONE horizontal row across a landscape canvas, evenly spaced, "
            f"with wide empty background gaps so no two frames touch or overlap. The same character at the same size and proportions in every frame, "
            f"all feet on the same invisible baseline. Side view, the character faces {facing}. ")

BLAZE = ("Character: the red three-eyed spotted cat from the reference (coral red fluffy body with round yellow spots, THREE big concentric-ring "
         "yellow eyes — two eyes plus a third eye on the forehead, a huge grin full of sharp white triangular teeth, yellow inner ears, red tail with yellow spots). "
         "It is an action hero that stands and runs UPRIGHT ON TWO HIND LEGS like a cartoon commando, front paws free (it holds no weapon). ")
GULP = ("Character: the grey-green tabby cat from the reference (slim grey-green body with dark tabby stripes, huge round yellow eyes with black slit pupils, "
        "pink nose, cream belly patch with a second fanged mouth in the middle of the belly, white paws, long striped tail), slender and a little nervous-looking. "
        "It is an action hero that stands and runs UPRIGHT ON TWO HIND LEGS like a cartoon commando, front paws free (it holds no weapon). ")

def hero(key, desc, ref, skill):
    return [
        dict(name=f"{key}_run", refs=[ref], prompt=STYLE + BG + sheet(6) + desc +
             "Frames: a 6-frame running cycle, legs alternating clearly, arms pumping, slight body bob."),
        dict(name=f"{key}_pose", refs=[ref], prompt=STYLE + BG + sheet(4) + desc +
             "Frames, left to right: 1) idle ready stance standing upright; 2) jumping upward, body stretched; "
             "3) curled into a tight round ball doing a somersault; 4) crouching very low and flat, ready to pounce."),
        dict(name=f"{key}_pose2", refs=[ref], prompt=STYLE + BG + sheet(3) + desc +
             "Frames, left to right: 1) dashing forward extremely fast, body leaning almost horizontal, a few speed lines behind; "
             "2) knocked out lying flat on its back, swirly dizzy eyes, tongue out, little stars; 3) " + skill),
    ]

JOBS = (
    hero("blaze", BLAZE, "refs/cat01.png",
         "special move: standing upright, the third forehead eye glowing bright yellow and shooting a thin targeting beam forward.")
    + hero("gulp", GULP, "refs/cat02.png",
           "special move: standing upright with the belly mouth opened extremely wide like a vacuum, swirl lines being sucked into the belly mouth.")
    + [
        dict(name="guns", refs=["refs/cat01.png", "refs/cat02.png"], prompt=STYLE + BG +
             "Two small chunky cartoon toy blasters side by side with a wide gap, both pointing RIGHT, perfectly horizontal side view: "
             "left one mustard yellow with red trim and a fish-shaped muzzle; right one coral red with yellow trim and a paw print on its side."),
        dict(name="runner", refs=["refs/cat05.png"], prompt=STYLE + BG + sheet(4, "LEFT") +
             "Character: the screaming red cat from the reference (tall pointy ears, one big yellow eye and one small white crazy eye, "
             "screaming wide-open mouth with a heart-shaped tongue, cream belly, red and yellow striped tail). It runs UPRIGHT on two legs, frantic. "
             "Frames: a 4-frame running cycle."),
        dict(name="bat", refs=["refs/cat04.png"], prompt=STYLE + BG + sheet(2, "LEFT") +
             "Character: the grey-green bat-winged cat from the reference (huge yellow eyes, small fangs, cream belly, red and yellow bat wings), flying. "
             "Frames: 1) wings raised high; 2) wings swept down. Seen from the front, turned slightly to the left."),
        dict(name="rat", refs=["refs/sheet.png"], prompt=STYLE + BG + sheet(2, "LEFT") +
             "Character: a Red Mouse army soldier — a grey rat with pink ears, pink feet and a long pink tail, a red bandana tied on its head, "
             "one glowing red eye, a tiny belt, standing upright and holding a small grey rifle. "
             "Frames: 1) standing guard holding the rifle; 2) firing the rifle forward with a small yellow muzzle flash."),
        dict(name="turret", refs=["refs/sheet.png"], prompt=STYLE + BG +
             "One object centered: a Red Mouse army cannon turret built from a giant grey tin can on two short stubby legs, "
             "a round metal dome on top, a red rat-face emblem painted on the front. Draw it WITHOUT any gun barrel. Front three-quarter view."),
        dict(name="fortress", refs=["refs/sheet.png"], prompt=STYLE + BG +
             "Portrait canvas. One tall object filling the full height: the stage boss, a cardboard cat-scratching-post tower taken over by the Red Mouse army. "
             "Corrugated cardboard, several sisal rope wraps, a red flag with a black rat silhouette on top. On its LEFT side: two empty dark square sockets "
             "at about 30% and 52% of the height, and one larger empty round socket at about 74% of the height (sockets are empty holes, no cannons inside)."),
        dict(name="ratking", refs=["refs/sheet.png"], prompt=STYLE + BG +
             "One character centered: the Rat King, final boss of the Red Mouse empire — a huge fat grey rat in a red cape with a crooked golden crown, "
             "holding a scepter topped with a glowing red gem, battle scars, menacing grin. Three-quarter front view, full body."),
        dict(name="items", refs=["refs/sheet.png"], prompt=STYLE + BG +
             "Game pickup icons in ONE horizontal row with wide gaps between them, all roughly the same size: "
             "1) a flying grey tin can of cat food with small white wings and a fish picture on its red label; "
             "then six round badge tokens with thick black outline, each showing ONE big bold black capital letter: "
             "2) S on a coral red badge, 3) M on a grey-green badge, 4) L on a pink-red badge, 5) F on a mustard yellow badge, "
             "6) R on a cream badge, 7) B on a light green badge."),
        dict(name="bg_far", refs=["refs/sheet.png"], prompt=STYLE +
             "Wide side-scrolling game background, far layer, landscape canvas: a long row of city apartment rooftops at dusk with water tanks and antennas, "
             "a few lit yellow windows, pale grey-green buildings filling the lower 70% of the canvas, plain cream paper sky above, no moon, no characters. "
             "Low contrast and soft so foreground stays readable. No text."),
        dict(name="bg_mid", refs=["refs/sheet.png"], prompt=STYLE + BG +
             "Wide side-scrolling game background, middle layer, landscape canvas: a long back-alley wooden fence of pointed planks running across the "
             "full width, with a torn 'missing cat' poster, a green trash can and a street lamp in front of it. The fence occupies only the bottom 40% "
             "of the canvas and its bottom edge touches the bottom of the canvas; everything above the fence is the plain cream background. No text."),
        dict(name="ground", refs=["refs/sheet.png"], prompt=STYLE +
             "Square canvas, a seamless tileable texture filling the whole canvas edge to edge: packed light tan earth (#D8C9A8) with small darker "
             "pebbles and paper grain, very flat and low contrast. No outline, no grass, no objects."),
        dict(name="title", refs=["refs/cat01.png", "refs/cat02.png"], prompt=STYLE +
             "Landscape key art for the title screen: the two heroes from the references — the red three-eyed spotted cat and the grey-green tabby "
             "with a mouth on its belly — standing back to back in heroic action poses holding chunky toy blasters, in a night back alley with a big "
             "yellow moon, several grey rats in red bandanas lurking in the background. Dynamic, fun. Absolutely no text or logo."),
    ]
)

if __name__ == "__main__":
    print(json.dumps(JOBS))

# --- polish pass: extra poses, enemy animation, effects ---
JOBS2 = [
    dict(name="blaze_aim", refs=["refs/cat01.png"], prompt=STYLE + BG + sheet(3) + BLAZE +
         "Frames, left to right: 1) standing, both front paws raised straight UP above the head as if aiming upward; "
         "2) standing, both front paws stretched forward and diagonally upward at 45 degrees as if aiming diagonally up; "
         "3) hurt: recoiling backward, eyes squeezed shut, fur standing on end, small impact stars."),
    dict(name="gulp_aim", refs=["refs/cat02.png"], prompt=STYLE + BG + sheet(3) + GULP +
         "Frames, left to right: 1) standing, both front paws raised straight UP above the head as if aiming upward; "
         "2) standing, both front paws stretched forward and diagonally upward at 45 degrees as if aiming diagonally up; "
         "3) hurt: recoiling backward, eyes squeezed shut, fur standing on end, small impact stars."),
    dict(name="ghost", refs=["refs/cat06.png"], prompt=STYLE + BG + sheet(2, "front") +
         "Character: the white ghost cat from the reference (cream ghost sheet body with wavy bottom, cat ears with yellow inner ears, "
         "two big black eyes, pink cheeks, yellow paw pads, little yellow feet), floating. Frames: 1) arms raised spooky, body wavy to the left; "
         "2) arms raised spooky, body wavy to the right."),
    dict(name="elite", refs=["refs/cat03.png"], prompt=STYLE + BG + sheet(3, "LEFT") +
         "Character: the huge fat fluffy white three-eyed cat from the reference (three yellow eyes — one on the forehead, small fangs, "
         "grey-green feet, cream fur, yellow-tipped tail), a heavy mid-boss, three-quarter view facing left. "
         "Frames: 1) standing menacingly; 2) mid-air jump, belly up, paws tucked; 3) the forehead eye glowing bright yellow, firing energy."),
    dict(name="fx", refs=["refs/sheet.png"], prompt=STYLE + BG +
         "Game visual effects in ONE horizontal row with wide gaps, all on their own, no characters: "
         "1) a small yellow muzzle flash star burst; 2) a small white and yellow hit spark burst; "
         "then a 4-frame cartoon explosion sequence of the same explosion growing and fading: 3) small red and yellow fireball; "
         "4) big round red, yellow and cream fireball with black outline; 5) breaking up into puffy cream smoke clouds; 6) a few small fading smoke puffs."),
]

# --- pass 3: projectiles, shooting effects, defeat effects ---
def row(n):
    return (f"Layout: exactly {n} separate items in ONE horizontal row across a landscape canvas, evenly spaced with wide empty gaps, "
            "nothing touching, each item roughly the same size. ")

FREED = ("Frames, left to right: 1) snapping out of mind control: dazed, shaking its head, spiral eyes clearing, a puff of dust; "
         "2) freed and happy: a calm, cute, smiling normal cat sitting contentedly, small pink heart above its head. ")

JOBS3 = [
    dict(name="bullets", refs=["refs/sheet.png"], prompt=STYLE + BG + row(7) +
         "Game projectile sprites, each flying to the RIGHT, side view, bold and juicy with a short motion tail behind: "
         "1) a fluffy mustard-yellow hairball bullet; 2) a fluffy coral-red hairball bullet; 3) a chunky grey cat-litter pellet with speed lines; "
         "4) a long glowing red laser-pointer bolt with a white hot core; 5) a yellow-orange catnip fireball with a flame tail and a green catnip leaf inside; "
         "6) a pink slimy spit glob; 7) an enemy energy orb: glowing crimson ball with a dark red rim and small sparks."),
    dict(name="muzzle", refs=["refs/sheet.png"], prompt=STYLE + BG + row(4) +
         "A 4-frame muzzle flash animation, pointing RIGHT, from a gun barrel tip on the left side of each item: "
         "1) small bright white-yellow spark; 2) big star-shaped yellow and white blast with red edges; 3) wide cone of flame and sparks; 4) fading wisps of smoke."),
    dict(name="impact", refs=["refs/sheet.png"], prompt=STYLE + BG + row(4) +
         "A 4-frame bullet impact animation: 1) small white flash; 2) yellow star burst with shards flying out; 3) ring of sparks; 4) tiny fading smoke puffs."),
    dict(name="explosion", refs=["refs/sheet.png"], prompt=STYLE + BG + row(6) +
         "A 6-frame cartoon explosion sequence of ONE explosion over time: 1) bright white-yellow flash; 2) growing red and yellow fireball; "
         "3) biggest fireball with black outlines and flying debris bits; 4) fireball breaking into orange and cream smoke; "
         "5) big puffy cream smoke clouds; 6) a few small fading smoke puffs."),
    dict(name="freed_runner", refs=["refs/cat05.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the red cat from the reference (tall pointy ears, red body, cream belly, red and yellow striped tail), but no longer screaming. " + FREED),
    dict(name="freed_bat", refs=["refs/cat04.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the grey-green cat with red and yellow bat wings from the reference, no longer fierce. " + FREED),
    dict(name="freed_ghost", refs=["refs/cat06.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the white ghost cat from the reference turning back into a fluffy white cat as the ghost sheet slips off. " + FREED),
    dict(name="freed_elite", refs=["refs/cat03.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the huge fat fluffy white three-eyed cat from the reference, no longer menacing. " + FREED),
    dict(name="soul", refs=["refs/cat01.png", "refs/cat02.png"], prompt=STYLE + BG + row(2) +
         "Cute cartoon 'lost one of nine lives' spirits, floating upward peacefully with eyes closed and a soft smile, slightly translucent pale versions "
         "with a small golden halo and tiny white angel wings: 1) the red three-eyed spotted cat from the first reference; "
         "2) the grey-green tabby with a mouth on its belly from the second reference."),
]

# --- pass 4: title screen redesign ---
JOBS4 = [
    dict(name="cover_bg", refs=["refs/sheet.png"], prompt=STYLE +
         "Wide cinematic 16:9 title-screen background for a side-scrolling action game, landscape canvas, NO characters in the middle and NO text: "
         "a back alley at night seen from street level, a huge glowing mustard-yellow full moon on the right third, layered rooftops and water tanks "
         "in grey-green silhouettes, red Red-Mouse-army flags with a black rat emblem on poles, wooden fences, trash cans, a few lit windows. "
         "Small grey rats in red bandanas peek from the very edges (trash can lid bottom-right, a window top-right). "
         "The left 45% of the image is calmer and darker (deep ink-blue night sky with a few stars) so a logo and menu can sit there."),
    dict(name="select_blaze", refs=["refs/cat01.png"], prompt=STYLE + BG +
         "One character, centered, tall portrait framing from the knees up: " + BLAZE.replace("(it holds no weapon)", "") +
         "Heroic action pose holding a chunky mustard-yellow toy blaster with red trim, grinning confidently, slight three-quarter view facing right."),
    dict(name="select_gulp", refs=["refs/cat02.png"], prompt=STYLE + BG +
         "One character, centered, tall portrait framing from the knees up: " + GULP.replace("(it holds no weapon)", "") +
         "Brave but slightly nervous action pose holding a chunky coral-red toy blaster with a paw print, belly mouth open, slight three-quarter view facing left."),
]

# --- pass 5: heroes really holding their guns; one gun per weapon ---
# The heroes are drawn with EMPTY gripping paws; the game draws the current weapon behind the
# body with its handle under the paws (grip points are measured per frame in gen/grips.json).
GRIP = ("Both front paws are held together out in front of the chest, clenched into small fists exactly as if firmly gripping the "
        "handle of a pistol — but the paws hold NOTHING: no gun, no weapon, no object at all, just the two empty clenched paws, clearly visible. ")

def grip_jobs(key, desc, ref):
    desc = desc.replace("front paws free (it holds no weapon). ", "")
    return [
        dict(name=f"{key}_grip", refs=[ref], prompt=STYLE + BG + sheet(6) + desc + GRIP +
             "Frames, left to right: 1) standing ready, gripping paws pointing straight FORWARD at shoulder height; "
             "2) standing, arms and gripping paws pointing diagonally UP-FORWARD at 45 degrees; "
             "3) standing, arms and gripping paws pointing straight UP above the head; "
             "4) standing, arms and gripping paws pointing diagonally DOWN-FORWARD at 45 degrees; "
             "5) crouching very low and flat, gripping paws pointing straight FORWARD; "
             "6) mid-jump with legs tucked up, gripping paws pointing straight FORWARD."),
        dict(name=f"{key}_griprun", refs=[ref], prompt=STYLE + BG + sheet(6) + desc + GRIP +
             "Frames: a 6-frame running cycle, legs alternating clearly, slight body bob, while both arms stay steady and stretched "
             "FORWARD at shoulder height with the empty gripping paws (like running while aiming a pistol)."),
    ]

JOBS5 = (
    grip_jobs("blaze", BLAZE, "refs/cat01.png")
    + grip_jobs("gulp", GULP, "refs/cat02.png")
    + [
        dict(name="weapons", refs=["raw/guns.png", "refs/cat01.png"], prompt=STYLE + BG + row(4) +
             "Draw them in EXACTLY the same style as the attached toy-blaster image: very THICK bold wobbly black ink outlines, chunky rounded "
             "simple shapes, big flat grainy color areas, very few small details, no thin lines, no fine engraving, nothing floating "
             "or detached from the gun (no glow rays, no sparks, no smoke). "
             "Four chunky cartoon toy guns for cat commandos, all pointing RIGHT, perfectly horizontal side view, each with a pistol-grip "
             "handle under its rear half, all drawn at the same scale: "
             "1) a stubby wide hairball shotgun with three short fat barrels side by side and a fluffy red pom-pom on top (coral red with yellow trim); "
             "2) a chunky cat-litter machine gun with a round drum magazine underneath and a long grey-green perforated barrel; "
             "3) a sleek long laser-pointer rifle, cream body with a round red lens at the tip and a small scope; "
             "4) a catnip flamethrower with a round mustard-yellow fuel tank on top, a flared nozzle and little green catnip leaves painted on it."),
    ]
)
