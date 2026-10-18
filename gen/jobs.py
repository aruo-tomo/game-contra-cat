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

# --- pass 6: skill effects (Blaze's third-eye beam, Gulp's belly-mouth suction) ---
JOBS6 = [
    dict(name="skill_beam", refs=["refs/cat01.png", "raw/bullets.png"], prompt=STYLE + BG +
         "One single object: a straight, perfectly HORIZONTAL section of a huge cartoon energy beam that runs across the WHOLE canvas from the "
         "very left edge to the very right edge, about one sixth of the canvas tall, centred vertically. Thick black wobbly ink outline only along "
         "its top and bottom edges. Inside: an outer band of coral red, a wide mustard-yellow middle, and a thin pale-yellow hot core line; "
         "lengthwise streaks and a few small ink speed dashes running along it, grainy print texture. The beam is the same all along its length "
         "(no start, no end, no taper, no sparks or particles around it)."),
    dict(name="skill_beamfx", refs=["refs/cat01.png", "raw/impact.png"], prompt=STYLE + BG + row(2) +
         "Two cartoon effect pieces for a third-eye laser beam fired to the RIGHT, no holes in them: "
         "1) the beam's source flare: a round blinding starburst flash with spiky rays, concentric yellow and red rings like a glowing target eye, "
         "thick black outline; 2) the beam's impact splash: a big jagged star-shaped burst splashing outward, yellow centre with red tips, "
         "a few chunky shards, thick black outline."),
    dict(name="skill_vortex", refs=["refs/cat02.png"], prompt=STYLE + BG + row(3) +
         "A 3-frame looping animation of a round cartoon suction vortex seen from the front, like a whirlpool of wind being sucked into a mouth: "
         "6 to 8 curved spiral arms of thick coral-red and mustard-yellow brush strokes with black ink outlines, swirling inward toward an empty "
         "centre, with wide gaps of background between the arms, small motion dashes. Each frame is the same vortex rotated a little further "
         "clockwise. Do NOT fill any area with white or cream: only red, yellow, grey-green and black strokes on the background."),
]

# --- pass 7: stage boss parts that sit in the fortress sockets ---
JOBS7 = [
    dict(name="boss_parts", refs=["raw/fortress.png", "refs/sheet.png"], prompt=STYLE + BG + row(5) +
         "Five separate parts for a cardboard fortress boss run by a Red Mouse army, all drawn at the same scale, thick black ink outlines, "
         "no cream or white fills (use grey-green metal, coral red, mustard yellow, black): "
         "1) a square riveted grey-green tin hatch plate seen straight from the front, with a round black ball-joint mount in its centre "
         "and a small glowing red rat-eye lamp above it; "
         "2) a short thick grey-green cannon barrel in side view pointing LEFT, perfectly horizontal, a red stripe near its muzzle, "
         "a round collar at its right end where it pivots; "
         "3) the same square tin hatch plate blown open: bent, torn and charred black, cracked, with one curl of grey smoke on top; "
         "4) a big round riveted grey-green tin porthole holding one giant angry red rat eye with a black vertical slit pupil looking LEFT, "
         "red veins, a small glossy highlight; "
         "5) the same porthole, its glass cracked in a star pattern and the red eye squinting in pain."),
]

# --- pass 8: heroes drawn really holding each gun (like the character-select art), no compositing ---
GUNS = {
    "blaze": "the chunky mustard-yellow toy blaster with red trim and a fish-shaped muzzle",
    "gulp": "the chunky coral-red toy blaster with yellow trim and a black paw print on its side",
    "S": "the stubby hairball shotgun with three short fat barrels and a fluffy red pom-pom on top",
    "M": "the chunky cat-litter machine gun with a round grey-green drum magazine underneath and a long perforated barrel",
    "L": "the long cream laser-pointer rifle with a small scope and a round red lens at the tip",
    "F": "the catnip flamethrower with a round mustard-yellow fuel tank on top and a flared grey-green nozzle",
}
HOLD = ("It holds {gun} from the second reference image firmly in BOTH front paws, like a cartoon action hero on a poster: "
        "the rear paw wraps around the gun's pistol grip with a finger on the trigger, the front paw holds the underside of the gun "
        "further forward. The gun is in front of the body, drawn big, crisp and detailed, exactly the same design and colours as the "
        "gun reference in every frame. No muzzle flash, no bullets, no speed lines. "
        "Clean flat colour fills: no smudges, no stray marks, no sweat drops, no sparkles or little motion ticks around the head. ")
# Gulp drifted into a furry, scratchy look; pin it to the smooth, thick-lined original (and its in-game grip sprites)
GULP_CLEAN = ("Draw the grey-green cat exactly like the references: a SMOOTH rounded head and body silhouette with clean, very THICK, "
              "smooth black outlines, the same as the third reference image. NOT furry, NOT scratchy: no fur tufts, no spiky cheek fur, "
              "no hairy or sketchy edges, no thin hatching lines. ")

HOLD_MODEL = {"blaze": "hold_blaze_N", "gulp": "hold_gulp_S"}


def hold_jobs(key, desc, ref, w):
    desc = desc.replace("front paws free (it holds no weapon). ", "")
    gun = GUNS[key if w == "N" else w]
    hold = HOLD.format(gun=gun) + (GULP_CLEAN if key == "gulp" else "")
    refs = [ref, f"refs/gun_{key if w == 'N' else w}.png"] + (["raw/gulp_grip.png"] if key == "gulp" else [])
    # every gun's sheet copies the approved look (Blaze holding N, Gulp holding S) so the hero doesn't change
    # face or build when it picks up another weapon
    model = HOLD_MODEL[key]
    if f"hold_{key}_{w}" != model:
        refs = [ref, refs[1], f"raw/{model}.png"]
        hold += ("The cat must look EXACTLY like the cat in the third reference image — the same character from the same sprite set: "
                 "the same body shape and proportions, the same face, eyes and viewing angle, the same thick smooth black outlines, "
                 "colours and texture. Only the gun is different. ")
    return [
        dict(name=f"hold_{key}_{w}", refs=refs, prompt=STYLE + BG + sheet(6) + desc + hold +
             "Frames, left to right: 1) standing, gun level and pointing straight FORWARD at shoulder height; "
             "2) standing, gun pointing diagonally UP-FORWARD at 45 degrees; 3) standing, gun pointing straight UP above the head; "
             "4) standing, gun pointing diagonally DOWN-FORWARD at 45 degrees; 5) crouching very low and flat, gun level pointing FORWARD; "
             "6) mid-jump with legs tucked up, gun level pointing FORWARD."),
        # running while aiming 45 degrees up / down (Contra-style), matched to the standing sheet like the level run
        *[dict(name=f"holdrun{d}_{key}_{w}", refs=[ref, refs[1], f"raw/hold_{key}_{w}.png"], prompt=STYLE + BG + sheet(6) + desc + hold +
               "The cat must look EXACTLY like the cat in the third reference image — the same character from the same sprite set: "
               "the same body shape and proportions, the same face and eyes, the same thick smooth black outlines, colours and texture, "
               "holding the same gun the same way. Not slimmer, not taller, not a different cartoon style. "
               "The background must be the plain cream colour, not transparent. "
               f"Frames: a 6-frame running cycle, legs alternating clearly, slight body bob, while the gun is held steady and pointing "
               f"diagonally {dd} at 45 degrees in every frame (like frame {fi} of the third reference image, but running).")
          for d, dd, fi in (("up", "UP-FORWARD", 2), ("down", "DOWN-FORWARD", 4))],
        # run cycles drifted into a slim, thin-lined, different-faced cat: match the standing sheet of the same gun
        dict(name=f"holdrun_{key}_{w}", refs=[ref, refs[1], f"raw/hold_{key}_{w}.png"], prompt=STYLE + BG + sheet(6) + desc + hold +
             "The cat must look EXACTLY like the cat in the third reference image — the same character from the same sprite set: "
             "the same chubby body shape and proportions, the same face and eyes, the same thick smooth black outlines, colours and texture, "
             "holding the same gun the same way. Not slimmer, not taller, not a different cartoon style. "
             "The background must be the plain cream colour, not transparent. " +
             "Frames: a 6-frame running cycle, legs alternating clearly, slight body bob, the gun held steady, level and pointing FORWARD."),
    ]

JOBS8 = [j for key, desc, ref in (("blaze", BLAZE, "refs/cat01.png"), ("gulp", GULP, "refs/cat02.png"))
         for w in ("N", "S", "M", "L", "F") for j in hold_jobs(key, desc, ref, w)]

# --- pass 9: opening story, American comic-book panels (no text: captions and speech bubbles are HTML, so they translate) ---
COMIC = ("Classic American comic-book panel art: dynamic dramatic camera angle, bold black ink lines and solid black shadows, "
         "Ben-Day halftone dot shading, a few action/speed lines, printed on slightly aged paper, using ONLY the palette coral red, "
         "mustard yellow, grey-green, cream and black. Wide landscape 3:2 panel filling the whole canvas edge to edge, no border. "
         "ABSOLUTELY NO TEXT, NO LETTERS, NO SPEECH BUBBLES, NO CAPTION BOXES, NO SOUND-EFFECT WORDS anywhere in the image. "
         "Keep the top fifth of the image simple (sky, wall or shadow) so a caption can be laid over it. ")
CAST = ("Blaze is the red three-eyed spotted cat from the first reference (coral red with round yellow spots, three big ring eyes, a huge grin "
        "of sharp teeth); Gulp is the grey-green tabby from the second reference (huge round yellow eyes, white paws, a second fanged mouth "
        "on its cream belly). Both stand upright on two legs like cartoon commandos. ")
RATS = "The villains are the Red Mouse army from the third reference: grey rats with pink ears and tails, red bandanas and one glowing red eye. "

def panel(n, refs, scene):
    return dict(name=f"story_{n}", refs=refs, prompt=STYLE + COMIC + scene)

JOBS9 = [
    panel(1, ["refs/cat01.png", "refs/cat02.png", "raw/cover_bg.png"],
          "Scene: a peaceful night over a cosy cartoon city of rooftops and water tanks under a huge mustard-yellow full moon. "
          "Many ordinary happy cats of all kinds nap on rooftops, sit on fences and play with a ball of yarn. Calm, warm, a little nostalgic."),
    panel(2, ["refs/sheet.png", "raw/ratking.png", "raw/fortress.png"],
          RATS + "Scene: deep under the city in a dark sewer cavern, the fat Rat King from the second reference stands on a scaffold, laughing "
          "with his arms raised, as rat soldiers pull a giant lever. Behind them rises a tall junk-built brainwave tower topped with a red "
          "rat-face dish, sending out big concentric red wave rings. Seen from a low angle, menacing."),
    panel(3, ["refs/cat05.png", "refs/cat04.png", "refs/cat03.png"],
          "Scene: the red brainwave rings sweep across the night rooftops. The city's cats are hit: their eyes turn into glowing red spirals, "
          "fur standing on end, they scream and twist into wild monsters — like the screaming red cat, the bat-winged cat and the huge fat "
          "white three-eyed cat from the references. Chaotic, dramatic, close-up on the screaming faces."),
    panel(4, ["refs/cat01.png", "refs/cat02.png"],
          CAST + "Scene: in a narrow back alley the same red waves wash over Blaze and Gulp but do nothing: the wave bends away from Blaze's "
          "glowing third eye, and Gulp's belly mouth is gulping a piece of the wave like noodles. Blaze grins, Gulp looks startled. "
          "Medium shot, both heroes clearly visible, trash cans and a wooden fence behind."),
    panel(5, ["refs/cat01.png", "refs/cat02.png", "raw/guns.png"],
          CAST + "Scene: in a messy alley hideout lit by one hanging bulb, Blaze cocks the mustard-yellow toy blaster with a fish-shaped muzzle "
          "from the third reference with a wild grin, while Gulp nervously hugs the coral-red toy blaster with a paw print. A crate of "
          "hairball ammo, a map of the city with a red rat symbol pinned on the wall. Heroic low angle."),
    panel(6, ["refs/cat01.png", "refs/cat02.png", "raw/fortress.png"],
          CAST + RATS.replace("from the third reference", "") +
          "Scene: Blaze and Gulp charge out of the alley side by side holding their toy blasters, running straight at the viewer, speed "
          "lines behind. Far in the background a cardboard cat-scratching-post fortress with a red rat flag, red wave rings rising from it, "
          "and tiny rat soldiers on its walls. Epic, the start of a big adventure."),
]

# --- pass 10: enemy shots that can't be mistaken for the heroes' (which are all bright warm hairballs / beams) ---
JOBS10 = [
    dict(name="enemy_shots", refs=["raw/bullets.png", "refs/sheet.png"], prompt=STYLE + BG + row(4) +
         "Four Red Mouse army enemy projectiles, drawn DARK so they read instantly against bright hero shots: mostly solid BLACK "
         "with thick ink outlines and only small red details, no glow halo, no motion trail, no flames, nothing yellow or cream: "
         "1) a small round black iron ball covered in short sharp spikes like a sea urchin, with one glowing red rat eye in its centre; "
         "2) the same spiked black ball rotated 45 degrees, the red eye half-closed; "
         "3) a bigger round black cartoon bomb with a red rat-face emblem on its side and a short sparking fuse on top; "
         "4) the same black bomb rotated, fuse spark bigger."),
]

# --- pass 11: more Red Mouse soldier types, each with its own silhouette so the player can read what it will do ---
RAT_BASE = ("Character: a Red Mouse army soldier drawn EXACTLY like the rat in the first reference image — the same grey-green rat with "
            "big pink ears, pink feet, a long pink striped tail, one big glowing red eye, a belt with a yellow pouch, the same thick "
            "black outlines, size and proportions. It stands upright. ")
JOBS11 = [
    dict(name="rat_gunner", refs=["raw/rat.png", "raw/weapons.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a heavy GUNNER: a round mustard-yellow army helmet instead of the bandana, a little chubbier, holding a big chunky "
         "grey-green machine gun with a round drum magazine at hip height with both paws. "
         "Frames: 1) braced, legs wide, gun level; 2) firing, body shaking back, three small yellow muzzle flashes in a row."),
    dict(name="rat_grenadier", refs=["raw/rat.png", "raw/enemy_shots.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a GRENADIER: no gun, a red bandana, a cross-body strap with three black round rat-face bombs from the second reference "
         "hanging on it. Frames: 1) holding one black bomb up beside its head, ready to throw, sly grin; "
         "2) mid overhand throw, arm swung forward high, the bomb just leaving its paw."),
    dict(name="rat_charger", refs=["raw/rat.png"], prompt=STYLE + BG + sheet(4, "LEFT") + RAT_BASE +
         "This one is a CHARGER: no gun, aviator goggles pushed up on its head, a red scarf flying behind, a big wooden fork held forward "
         "like a spear, angry teeth showing. Frames: 1) and 2) a fast sprint cycle leaning forward, legs alternating; "
         "3) crouched low about to leap; 4) leaping forward through the air, fork thrust out."),
    dict(name="rat_sniper", refs=["raw/rat.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a SNIPER: a red beret instead of the bandana, kneeling on one knee, holding a very long thin grey rifle with a big "
         "scope pressed to its red eye. Frames: 1) kneeling, aiming the long rifle perfectly level, very still; "
         "2) the same pose with a sharp small yellow muzzle flash and the rifle kicking up slightly."),
]

# --- pass 12: stage 2, the pet-hospital corridor taken over by the Red Mouse army ---
HOSP = ("Setting: a cartoon PET HOSPITAL that the Red Mouse army has taken over: pale grey-green tiled walls, cream doors with round windows, "
        "red cross signs, small red rat-face army flags. ")
JOBS12 = [
    dict(name="rat_nurse", refs=["raw/rat.png", "raw/rat_gunner.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a NURSE MEDIC: a small white nurse cap with a red cross instead of the bandana, a cream apron over the belt, "
         "no gun; it holds a big syringe with a red liquid in one paw. "
         "Frames: 1) standing, holding the big syringe up beside its head like a dart, sly grin; "
         "2) mid overhand throw, arm swung forward high, the syringe just leaving its paw pointing forward."),
    dict(name="rat_shield", refs=["raw/rat.png", "raw/rat_gunner.png"], prompt=STYLE + BG + sheet(3, "LEFT") + RAT_BASE +
         "This one is a SHIELD guard: the yellow helmet from the second reference, carrying a big tall rectangular grey-green metal riot shield "
         "made from a hospital X-ray light box (it shows a white cat skeleton X-ray picture and a red cross), held in front of its whole body; "
         "a small grey pistol in the other paw. Frames: 1) and 2) walking forward crouched behind the shield, legs alternating; "
         "3) shield swung aside, leaning out and firing the pistol forward with a small yellow muzzle flash."),
    dict(name="rat_spray", refs=["raw/rat.png", "raw/rat_gunner.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a DISINFECTANT SPRAYER: a grey-green gas mask with round glass eyes over its face, a mustard-yellow pressure tank on "
         "its back connected by a hose to a long spray wand held forward. Frames: 1) standing, wand pointed forward; "
         "2) spraying: a short puff of green mist just leaving the nozzle, body braced."),
    dict(name="conecat", refs=["refs/cat05.png", "raw/runner.png"], prompt=STYLE + BG + sheet(3, "LEFT") +
         "Character: the screaming red cat from the references (tall pointy ears, one big yellow eye and one small white crazy eye, "
         "cream belly, red and yellow striped tail) as a brainwashed hospital PATIENT: it wears a big cream plastic cone collar "
         "(Elizabethan cone) around its neck and a white bandage around one leg. It stands UPRIGHT on two legs. "
         "Frames: 1) and 2) a stomping walk, legs alternating; 3) yowling extremely loudly into the cone, which acts like a megaphone, "
         "curved sound lines blasting out of the cone."),
    dict(name="freed_conecat", refs=["refs/cat05.png", "raw/freed_runner.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the red cat from the references (tall pointy ears, red body, cream belly, red and yellow striped tail) still wearing a "
         "cream plastic cone collar, but no longer screaming. " + FREED),
    dict(name="headnurse", refs=["raw/rat.png", "raw/elite.png"], prompt=STYLE + BG + sheet(3, "LEFT") + RAT_BASE.replace("It stands upright. ", "") +
         "This one is the HEAD NURSE, a mid-boss: a HUGE fat rat twice as big and round as the others, a tall white nurse cap with a red cross, "
         "a cream nurse dress with a red belt, round spectacles over its red eye, carrying a gigantic syringe as long as its body like a lance. "
         "Frames: 1) standing menacingly, the giant syringe held upright; 2) charging forward low, the giant syringe thrust straight out in front "
         "like a jousting lance, speed lines behind; 3) throwing three small syringes at once in a fan from its paw, mouth open shouting."),
    dict(name="surgeon", refs=["raw/fortress.png", "raw/rat.png"], prompt=STYLE + BG +
         "Portrait canvas. One tall object filling the full height: the stage 2 boss, a giant Red Mouse SURGERY MACHINE built into a hospital "
         "operating-room wall: grey-green riveted metal cabinet with pipes, dials and a red rat-face emblem, a small red rat army flag on top. "
         "On its LEFT side: one empty dark round socket at about 25% of the height, one empty dark square socket at about 50% of the height, "
         "and one larger empty round socket at about 75% of the height (sockets are empty holes, nothing inside them)."),
    dict(name="surgeon_parts", refs=["raw/boss_parts.png", "raw/rat.png"], prompt=STYLE + BG + row(5) +
         "Five separate parts for a Red Mouse surgery-machine boss, all at the same scale, thick black ink outlines, grey-green metal, "
         "coral red, mustard yellow and black (no white fills): "
         "1) a round operating-room surgical LAMP head seen from the front, mustard-yellow glowing glass with a riveted grey-green rim; "
         "2) a long jointed grey-green robot ARM in side view pointing LEFT, perfectly horizontal, ending in a big shiny scalpel blade; "
         "3) a short fat grey-green cannon in side view pointing LEFT that ends in a big syringe needle, red liquid inside; "
         "4) a round glass jar on a metal base holding a small angry rat doctor wearing a surgical mask and head mirror, looking LEFT; "
         "5) the same glass jar cracked in a star pattern, the rat doctor dizzy and scared."),
    dict(name="hosp_shots", refs=["raw/enemy_shots.png", "refs/sheet.png"], prompt=STYLE + BG + row(4) +
         "Four Red Mouse army enemy projectiles in the SAME dark style as the attached shots (mostly black and coral red, thick ink outlines, "
         "nothing yellow or cream, no glow): 1) a small syringe dart flying RIGHT, black body, red liquid, sharp needle tip, tiny black tail fins; "
         "2) a round puffy cloud of poison gas, murky dark grey-green with black outline and a small red skull-rat symbol; "
         "3) a fat black medicine capsule pill bomb with a red half and a short sparking fuse; "
         "4) the same pill bomb rotated 45 degrees, fuse spark bigger."),
    dict(name="laser_emitter", refs=["raw/turret.png", "refs/sheet.png"], prompt=STYLE + BG + row(2) +
         "Two wall-mounted Red Mouse security laser emitters, grey-green riveted metal boxes with a red rat-face emblem, side view, "
         "the lens points RIGHT: 1) idle, the round lens dark red; 2) firing, the lens glowing bright red with short spiky rays."),
    dict(name="gurney", refs=["raw/turret.png", "refs/sheet.png"], prompt=STYLE + BG +
         "One object centered, side view: a hospital gurney trolley on four small black castor wheels, a flat cream mattress on top, "
         "grey-green metal frame, a small red cross on its side, a red rat army sticker. Perfectly horizontal and much wider than tall."),
    dict(name="bg2_far", refs=["raw/bg_far.png", "refs/sheet.png"], prompt=STYLE + HOSP +
         "Wide side-scrolling game background, far layer, landscape canvas: the long back wall of a hospital ward seen from the side: tall "
         "windows showing a night city with a mustard moon, grey-green tiled lower wall, cream upper wall, hanging ward curtains, red cross signs, "
         "pipes along the ceiling, a few red rat-face army banners. Low contrast and soft so the foreground stays readable. No characters, no text."),
    dict(name="bg2_mid", refs=["raw/bg_mid.png", "refs/sheet.png"], prompt=STYLE + BG + HOSP +
         "Wide side-scrolling game background, middle layer, landscape canvas: a long hospital corridor wall running across the full width: "
         "cream swinging doors with round porthole windows, an IV drip stand, an empty wheelchair, a red cross sign, a cat X-ray light box, "
         "a poster of a happy cat. The wall occupies only the bottom 45% of the canvas and its bottom edge touches the bottom of the canvas; "
         "everything above is the plain background. No text, no characters."),
    dict(name="floor2", refs=["raw/ground.png"], prompt=STYLE +
         "Square canvas, a seamless tileable texture filling the whole canvas edge to edge: hospital floor of large pale grey-green square "
         "linoleum tiles with thin darker grout lines and paper grain, flat and low contrast. No outline, no objects."),
]

# --- pass 13: stage 3, the giant fish-tank waterfall (a vertical climb); bosses are creatures, not towers ---
TANK = ("Setting: inside a giant home aquarium that the Red Mouse army has taken over: a tall waterfall pouring down from a filter, "
        "aquarium pebbles, rocks, water plants, bubbles, a sunken toy castle ornament. Water is drawn in grey-green and cream streaks "
        "(no blue), in the same limited palette. ")
JOBS13 = [
    dict(name="koi_boss", refs=["raw/fortress.png", "raw/rat.png", "raw/elite.png"], prompt=STYLE + BG + sheet(4, "LEFT") +
         "Character: the stage 3 boss, a GIANT ROBOT KOI CARP built by the Red Mouse army: a long chunky koi body with coral-red and cream "
         "koi patches, riveted grey-green metal armour plates on its back and head, big flowing fins and tail, one huge glowing red rat eye, "
         "a wide mouth full of metal teeth. A small Red Mouse ADMIRAL rides on its back: the same grey rat as the second reference with a "
         "black bicorne hat with a red rat emblem, a red coat and a spyglass. The koi is much wider than tall and fills each frame. "
         "Frames: 1) swimming forward horizontally, mouth closed, fins waving; 2) the same pose with the mouth stretched wide open, "
         "a glow deep inside its throat, cheeks bulging, about to blast water; 3) leaping in a tight C-shaped arc, body curled, tail "
         "flicking water drops; 4) battle-damaged: armour plates torn off, sparks, a cracked glowing red core showing in its side, "
         "the admiral furious waving the spyglass."),
    dict(name="pirate_cat", refs=["refs/cat04.png", "raw/elite.png"], prompt=STYLE + BG + sheet(4, "LEFT") +
         "Character: the stage 3 mid-boss, a big burly brainwashed PIRATE CAPTAIN CAT: grey-green fur with dark tabby stripes like the "
         "first reference, a black eyepatch, one red spiral hypnotised eye, a red pirate coat with yellow buttons, a black tricorn hat, a "
         "curved cutlass in one paw and a heavy black iron anchor on a chain over its shoulder. It stands UPRIGHT on two legs, about twice "
         "as bulky as a normal cat. Frames: 1) standing menacingly, cutlass raised, anchor on shoulder; 2) dashing forward low with a huge "
         "cutlass slash, speed lines behind; 3) swinging the anchor round overhead on its chain, about to hurl it; 4) leaping high in the "
         "air, cutlass held up, coat flapping."),
    dict(name="bg3_far", refs=["raw/bg2_far.png", "refs/sheet.png"], prompt=STYLE + TANK +
         "Tall PORTRAIT canvas: a vertical side-scrolling game background, far layer. Inside the giant aquarium looking at its back wall: "
         "a tall waterfall pouring from the very top to the very bottom down the middle, mossy rocks and tall water plants on both sides, "
         "rising bubbles, a toy sunken castle half hidden on one side, a red Red Mouse army flag stuck in a rock, faint aquarium glass "
         "reflections. The top edge and bottom edge look alike so it can repeat vertically. Low contrast and soft so the foreground "
         "stays readable. No characters, no text."),
]

# --- pass 14: stage 3 is part climb, part dive. Under water the heroes wear a fishbowl diving helmet and an air
# tank and swim, still holding (and firing) the current gun; one sheet per hero per gun, like the held-gun sheets ---
DIVE = ("It is UNDER WATER: it wears a big round clear glass fishbowl diving helmet over its whole head (the face and eyes clearly "
        "visible through the glass, a thick black outline round the glass, a small shine highlight, a brass rim at the neck) and a "
        "small mustard-yellow oxygen tank strapped on its back with a short hose to the helmet. It SWIMS with its body stretched out "
        "HORIZONTALLY, legs kicking behind like a frog, tail streaming back. ")

def swim_job(key, desc, ref, w):
    desc = desc.replace("front paws free (it holds no weapon). ", "").replace("stands and runs UPRIGHT ON TWO HIND LEGS like a cartoon commando, ", "")
    gun = GUNS[key if w == "N" else w]
    hold = HOLD.format(gun=gun) + (GULP_CLEAN if key == "gulp" else "")
    return dict(name=f"swim_{key}_{w}", refs=[ref, f"refs/gun_{key if w == 'N' else w}.png", f"raw/hold_{key}_{w}.png"],
                prompt=STYLE + BG + sheet(4) + desc + DIVE + hold +
                "The cat must look EXACTLY like the cat in the third reference image — the same face, eyes, colours, thick smooth "
                "black outlines and texture, holding the same gun the same way — only now swimming. No bubbles, no water lines. "
                "Frames, left to right: 1) swimming horizontally, legs kicked back, gun level pointing straight FORWARD; "
                "2) the same with the legs drawn in for the next kick (swim cycle), gun level pointing FORWARD; "
                "3) body tilted nose-up, gun pointing diagonally UP-FORWARD at 45 degrees; "
                "4) body tilted nose-down, gun pointing diagonally DOWN-FORWARD at 45 degrees.")

JOBS14 = [swim_job(key, desc, ref, w) for key, desc, ref in (("blaze", BLAZE, "refs/cat01.png"), ("gulp", GULP, "refs/cat02.png"))
          for w in ("N", "S", "M", "L", "F")] + [
    dict(name="bg3_air", refs=["raw/bg3_far.png", "raw/bg2_far.png"], prompt=STYLE + TANK +
         "Tall PORTRAIT canvas: a vertical side-scrolling game background, far layer, ABOVE THE WATER LINE inside the giant aquarium: "
         "tall stacked rock towers and driftwood rising out of the water, a big toy pirate shipwreck ornament on one side, the filter "
         "waterfall pouring down the middle from a black filter box at the top, the tank's glass walls with soft reflections, a few red "
         "Red Mouse army flags planted on the rocks — each flag shows the army's emblem exactly like the flag in the second reference: "
         "an ANGRY RAT FACE with a pointed snout, whiskers and slanted eyes; never a round head with two round ears (no mouse-ear "
         "silhouette, nothing like any famous cartoon mouse) — the dim room behind the glass. Same style and palette as the first reference. "
         "The top edge and bottom edge look alike so it can repeat vertically. Low contrast and soft. No characters, no text."),
    dict(name="bowlcat", refs=["refs/cat04.png", "raw/conecat.png"], prompt=STYLE + BG + sheet(3, "LEFT") +
         "Character: a brainwashed cat (the grey-green cat from the first reference without its wings: huge yellow eyes turned to red "
         "hypnotised spirals, small fangs, cream belly) wearing a round clear glass FISHBOWL helmet over its head with a tiny orange "
         "goldfish swimming inside it, and a red scarf. The fishbowl is MUCH BIGGER than the head and its whole head — ears, "
         "snout, nose, mouth, fangs and whiskers — is completely INSIDE the glass, well clear of the bowl's outline: nothing pokes "
         "out through the glass. The cat's face is seen through the glass. It stands UPRIGHT on two legs, same size as the cat in the second reference. "
         "It throws fishbones like boomerangs. Frames: 1) and 2) a sneaky walk, legs alternating, a fish skeleton bone held in one paw; "
         "3) mid sidearm throw, arm swung forward, the bone just leaving its paw spinning."),
]

# --- pass 15: the rest of stage 3's cast ---
JOBS15 = [
    dict(name="puffer", refs=["raw/turret.png", "raw/enemy_shots.png"], prompt=STYLE + BG + row(2) +
         "A Red Mouse army ROBOT PUFFERFISH MINE, side view facing LEFT, both at the same scale: riveted grey-green metal body, "
         "one big glowing red rat eye, small fins and a tiny propeller tail, a red rat-face emblem on its side. "
         "1) normal: a small round fish with short stubby spikes folded flat; "
         "2) inflated: blown up into a huge round ball twice as big, long sharp black spikes sticking out all round, eye glowing angrily."),
    dict(name="scuba_rat", refs=["raw/rat.png", "raw/rat_gunner.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a SCUBA DIVER: a round diving mask over its red eye, a snorkel, a mustard-yellow air tank on its back, black "
         "flippers on its feet, holding a long grey-green harpoon gun with a barbed harpoon loaded at the front. "
         "Frames: 1) standing braced, aiming the harpoon gun level forward; 2) the harpoon just fired (gun empty), recoil, a small "
         "yellow puff at the muzzle."),
    dict(name="eel", refs=["raw/turret.png", "raw/laser_emitter.png"], prompt=STYLE + BG + row(2) +
         "The HEAD of a Red Mouse army ROBOT EEL, side view facing RIGHT, both at the same scale: a long rounded grey-green riveted "
         "metal snout with a red stripe, one glowing red eye, a jaw of sharp metal teeth, a little ribbed neck at the back edge. "
         "1) mouth closed, eye dim, sneaky; 2) mouth wide open, yellow electric sparks crackling between its teeth, eye blazing red."),
    dict(name="can_rat", refs=["raw/rat.png", "raw/rat_grenadier.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a SAILOR: a white sailor cap with a red band instead of the bandana, a striped neckerchief, no gun; it rolls big "
         "round tins of fish food. Frames: 1) holding a big round silver tin of cat food with a red fish label up in both paws, grinning; "
         "2) bent low, bowling the tin forward along the ground with both paws, the tin just leaving its paws."),
    dict(name="freed_bowlcat", refs=["raw/bowlcat.png", "raw/freed_runner.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the grey-green cat from the first reference, the glass fishbowl helmet now off and held under one arm (the little "
         "goldfish still inside it), eyes back to normal big yellow cat eyes, red scarf. " + FREED),
    dict(name="freed_pirate", refs=["raw/pirate_cat.png", "raw/freed_elite.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the burly grey-green tabby pirate captain cat from the first reference (red coat, tricorn hat, eyepatch), the "
         "red hypnotised spiral gone from its eye, no cutlass or anchor any more. " + FREED),
    dict(name="aqua_shots", refs=["raw/enemy_shots.png", "raw/hosp_shots.png"], prompt=STYLE + BG + row(6) +
         "Six Red Mouse army projectiles in the SAME dark style as the attached shots (thick ink outlines, black, grey-green and coral "
         "red, no glow): 1) a white fish skeleton bone (head, spine and ribs, tail) seen from the side, used as a boomerang; "
         "2) a barbed metal harpoon flying RIGHT with a short frayed rope at its back; "
         "3) a fat drop of murky grey-green water flying RIGHT with a short splash tail; "
         "4) a small black torpedo flying RIGHT with a red rat-face nose and a tiny propeller; "
         "5) a round silver tin of cat food with a red fish label, side view, like a wheel; "
         "6) a heavy black iron ship's anchor with a ring on top."),
]

# --- pass 16: stage 4, the pet hospital basement (Dr. Rat's brainwashing lab) ---
LAB = ("Setting: the secret basement lab under the pet hospital, where the Red Mouse army brainwashes cats: concrete walls, steam "
       "pipes, riveted grey-green machines, glowing red brainwave antennas, specimen tanks. ")
JOBS16 = [
    dict(name="spider_mech", refs=["raw/koi_boss.png", "raw/surgeon.png", "raw/rat.png"], prompt=STYLE + BG + sheet(4, "LEFT") +
         "Character: the stage 4 boss, DR. RAT's BRAINWAVE SPIDER MECH: a big round riveted grey-green metal body on six long jointed "
         "spider legs with red claw tips, a clear glass dome cockpit on top with a small grey rat scientist inside (lab coat, round "
         "goggles, wild white hair), a big red brainwave antenna dish on the front that glows with concentric red rings, a red rat-face "
         "emblem on the body. The same machine at the same size in every frame. Frames: 1) walking forward on its six legs; "
         "2) rearing up on its back legs, the antenna dish blasting glowing red concentric brainwave rings forward; 3) hanging UPSIDE "
         "DOWN as if clinging to a ceiling, legs gripping above, the dish pointing down; 4) its legs blown off: only the round body and "
         "the glass dome left, now flying on two small sputtering jet thrusters underneath, cracked, the rat scientist furious."),
    dict(name="drill_boss", refs=["raw/headnurse.png", "raw/turret.png", "raw/rat.png"], prompt=STYLE + BG + sheet(3, "LEFT") +
         "Character: the stage 4 mid-boss, a Red Mouse army DRILL DIGGER: a squat riveted grey-green digging machine with a huge "
         "mustard-yellow cone drill on the front, two clamp arms, caterpillar tracks, a small grey rat engineer with a yellow hard hat "
         "and goggles driving it from an open cab. It clings to walls. Frames: 1) idle, drill pointing forward, spinning lines; "
         "2) lunging forward, the drill shoved out far on a long extending piston arm, sparks; 3) a clamp arm swung forward hurling "
         "a round spinning saw-blade disc."),
    dict(name="hypno_cat", refs=["refs/cat06.png", "raw/conecat.png"], prompt=STYLE + BG + sheet(3, "LEFT") +
         "Character: a brainwashed cat from the lab: a fluffy cream cat like the first reference (small yellow paws, pink cheeks) wearing "
         "a metal brainwashing headset with a tall antenna topped by a glowing red bulb, eyes turned to red hypnotised spirals, a "
         "hospital-gown bib. It stands UPRIGHT on two legs, same size as the cat in the second reference, zombie-like. "
         "Frames: 1) and 2) a slow sleepwalking shuffle, arms stretched forward, legs alternating; "
         "3) head tilted back, the antenna bulb blazing and sending out glowing red concentric rings."),
]

# --- pass 17: the rest of stage 4's cast and scenery ---
JOBS17 = [
    dict(name="flame_rat", refs=["raw/rat.png", "raw/rat_spray.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a FLAMETHROWER trooper: a black welding mask pushed up on its head, thick red gloves, a round red fuel tank on its "
         "back joined by a hose to a stubby grey-green flamethrower nozzle held forward at hip height. Frames: 1) braced, nozzle forward, "
         "a tiny blue-yellow pilot flame at the tip; 2) firing: a short burst of orange-yellow flame just leaving the nozzle, body leaning back."),
    dict(name="tesla_rat", refs=["raw/rat.png", "raw/rat_spray.png"], prompt=STYLE + BG + sheet(2, "LEFT") + RAT_BASE +
         "This one is a TESLA trooper: rubber goggles, a backpack generator with a tall copper tesla coil sticking up above its head "
         "topped by a round metal ball, a red bandana. Frames: 1) standing, one paw pointing forward; 2) zapping: yellow lightning "
         "crackling round the coil ball and down its pointing arm, fur standing on end."),
    dict(name="spiderbot", refs=["raw/spider_mech.png", "raw/puffer.png"], prompt=STYLE + BG + row(3) +
         "A small Red Mouse army SPIDER-BOT, side view, all three at the same scale: a round riveted grey-green metal body the size of a "
         "fist, one glowing red rat eye, six thin jointed legs with red tips. 1) walking, legs mid-step; 2) walking, legs the other way; "
         "3) dropping down with all legs spread wide."),
    dict(name="pod", refs=["raw/hypno_cat.png", "raw/surgeon.png"], prompt=STYLE + BG + row(2) +
         "Lab SPECIMEN TANKS, both at the same scale, front view, much taller than wide: a tall glass cylinder with a riveted grey-green "
         "metal base and cap, red cables, pale grey-green liquid inside with bubbles. 1) a sleeping cream cat curled up floating inside "
         "the tank wearing a little brainwashing headset; 2) the same tank smashed open, glass shards, empty, liquid spilling."),
    dict(name="freed_hypnocat", refs=["raw/hypno_cat.png", "raw/freed_runner.png"], prompt=STYLE + BG + sheet(2, "RIGHT") +
         "Character: the fluffy cream cat from the first reference in its hospital gown, the brainwashing headset now broken and "
         "falling off, eyes back to normal. " + FREED),
    dict(name="lab_shots", refs=["raw/enemy_shots.png", "raw/aqua_shots.png"], prompt=STYLE + BG + row(3) +
         "Three projectiles in the SAME style as the attached shots (thick ink outlines, no glow halo): "
         "1) a round spinning circular saw blade, grey metal teeth, a yellow hub; "
         "2) a puff of flame flying RIGHT, orange and yellow with a red edge and a black outline; "
         "3) a set of three glowing red concentric hypnosis rings like a target, with a tiny black spiral in the centre."),
    dict(name="bg4_far", refs=["raw/bg2_far.png", "refs/sheet.png"], prompt=STYLE + LAB +
         "Wide side-scrolling game background, far layer, landscape canvas: the long back wall of the secret basement lab: rows of "
         "glowing specimen tanks, big brainwave machines with red antenna dishes, thick pipes along the ceiling, grey concrete walls "
         "with hazard stripes, a giant red rat-face emblem banner. Low contrast and soft so the foreground stays readable. No characters, no text."),
    dict(name="bg4_mid", refs=["raw/bg2_mid.png", "refs/sheet.png"], prompt=STYLE + BG + LAB +
         "Wide side-scrolling game background, middle layer, landscape canvas: a basement corridor wall running across the full width: "
         "riveted steel panels, valves and pressure gauges, a big round vault door, a bank of blinking computer consoles, crates. "
         "The wall occupies only the bottom 45% of the canvas and its bottom edge touches the bottom of the canvas; everything above is "
         "the plain background. No text, no characters."),
    dict(name="bg4_shaft", refs=["raw/bg4_far.png", "raw/bg3_air.png"], prompt=STYLE + LAB +
         "Tall PORTRAIT canvas: a vertical game background: looking at the back wall of a deep freight-lift shaft going down into the "
         "basement: riveted steel girders, cross braces, cables, hazard-striped beams, caged work lights, pipes, a painted floor number "
         "'B2' style sign without letters (just stripes). The top edge and bottom edge look alike so it can repeat vertically. "
         "Low contrast and soft. No characters, no text."),
]
