/*

  ▄████  ██▓  ▄▄▄█████▓ ▄████▄   ██░ ██  ██▒   █▓ ██▀███    ██████
 ██▒ ▀█▒▓██▒  ▓  ██▒ ▓▒▒██▀ ▀█  ▓██░ ██▒▓██░   █▒▓██ ▒ ██▒▒██    ▒
▒██░▄▄▄░▒██░  ▒ ▓██░ ▒░▒▓█    ▄ ▒██▀▀██░ ▓██  █▒░▓██ ░▄█ ▒░ ▓██▄
░▓█  ██▓▒██░  ░ ▓██▓ ░ ▒▓▓▄ ▄██▒░▓█ ░██   ▒██ █░░▒██▀▀█▄    ▒   ██▒
░▒▓███▀▒░██████▒▒██▒ ░ ▒ ▓███▀ ░░▓█▒░██▓   ▒▀█░  ░██▓ ▒██▒▒██████▒▒
 ░▒   ▒ ░ ▒░▓  ░▒ ░░   ░ ░▒ ▒  ░ ▒ ░░▒░▒   ░ ▐░  ░ ▒▓ ░▒▓░▒ ▒▓▒ ▒ ░
  ░   ░ ░ ░ ▒  ░  ░      ░  ▒    ▒ ░▒░ ░   ░ ░░    ░▒ ░ ▒░░ ░▒  ░ ░
░ ░   ░   ░ ░   ░      ░         ░  ░░ ░     ░░    ░░   ░ ░  ░  ░
      ░     ░  ░       ░ ░       ░  ░  ░      ░     ░           ░
                       ░                     ░

code by {protocell:labs}, assets by jrdsctt
for Glitch Forge, 2022

*/

import { getRandomImage } from "./util.js";
import { calculateRoyalties } from "./royalties.js";
import { sliceFrame, init as eInit } from "./effects/tartaria.js";
import { weightedChoice, animateMonochromeDither, animateTintedDither, animateDitherSorting, animateSortingDither, animateAbstractDither } from "./effects/protocell_labs.js";

import GIFEncoder from 'gifencoder';
import fs from 'fs';
import pkg from 'canvas';
const { createCanvas, loadImage } = pkg;

var r; //assign random hash access
var WIDTH; var HEIGHT;
var random = null;
var royalties;

// Guaranteed to be called first.
export function init(rnd, txn_hash) {
  Math.random = rnd;
  random = rnd;
  eInit(rnd);
}

// Guaranteed to be called after setup(), can build features during setup
// Add your rarity traits and attributes to the features object
const features = {};
export function getFeatures() {
  return features;
}

export function getMetadata() {
  return {
    "features": features,
    "royalties": royalties
  }
}

/*
  Get a random number between a and b
*/
function rbtw(a, b, random) {
  return a + (b - a) * random();
}

function getMask(DIM) {
  var mask = sketch.createGraphics(DIM, DIM);
  mask.noStroke();
  mask.fill(255, 255, 255, 255);
  return mask;
}
/*
  Apply a mask, used for cutting shapes out of one canvas
  and pasting them onto another.
*/
function applyMask(source, target) {
  let clone;
  (clone = source.get()).mask(target.get());
  sketch.image(clone, 0, 0);
}






// Receives:
// sketch: a p5js instance
// txn_hash: the transaction hash that minted this nft (faked in sandbox)
// random: a function to replace Math.random() (based on txn_hash)
// assets: an object with preloaded image assets from `export getAssets`, keyname --> asset
export async function draw(sketch, assets) {
  let startmilli = Date.now();

  //Fixed Canvas Size, change as needed
  WIDTH = 900;
  HEIGHT = 900;
  let image_border = [100, 100];

  let royalty_tally = {}
  //Populate the features object like so, it is automatically exported.
  features['Trait Name'] = "Trait Value";

  console.log("---Processing Starting---");
  let sketch_canvas = sketch.createCanvas(WIDTH + image_border[0], HEIGHT + image_border[1]);
  try {

    // SELECTION OF EFFECTS STACK
    // 0 -> Monochrome dither
    // 1 -> Tinted dither
    // 2 -> Color dither + pixel sorting
    // 3 -> Pixel sorting + color dither
    // 4 -> Abstract dither

    let animation_name = 'gltchvrs_' + Math.floor(Math.random() * 10000) + '.gif';

    let effects_stack_weights = [ [0, 20], [1, 20], [2, 20], [3, 20], [4, 20] ]; // these represent probabilities for choosing an effects stack number [element, probability]
    let effects_stack_type = weightedChoice(effects_stack_weights, sketch); // type of effects workflow to be used as a number, 0-4
    //let effects_stack_type = 4; // override for the type of effects workflow to be used as a number, 0-4
    let effects_stack_names = ['monochrome dither', 'tinted dither', 'color dither + pixel sorting', 'pixel sorting + color dither', 'abstract dither']; // type of effects workflow to be used as a string
    let effects_stack_name = effects_stack_names[effects_stack_type]; // type of effects workflow to be used as a string

    // SELECTION OF SOURCE THEME
    let source_themes = ['citizen', 'cityscape', 'covers', 'scenes'];
    let source_theme_weights = [ [0, 35], [1, 35], [2, 25], [3, 5] ]; // these represent probabilities for choosing a source theme number [element, probability]
    let source_theme_nr = weightedChoice(source_theme_weights, sketch); // 0 -> citizen, 1 -> cityscape, 2 -> covers, 3 -> scenes
    //let source_theme_nr = 1; // override for the source theme
    let source_theme = source_themes[source_theme_nr]; // 'citizen', 'cityscape', 'covers', 'scenes'

    // EXCEPTIONS - these skew the choice probabilities from above
    if (effects_stack_type == 4) {source_theme_nr = 0}; // Abstract dither effect stack works only with citizen theme

    /*
     Make a copy of the raw image for reference.
     If the raw image is too large, a random section is chosen to match our fixed canvas size.
    */
    let referenceGraphic = sketch.createImage(WIDTH, HEIGHT);

    let image = await getRandomImage(assets, source_theme, sketch)
    const copyStartX = Math.floor(random() * (image.width - WIDTH));
    const copyStartY = Math.floor(random() * (image.height - HEIGHT));

    referenceGraphic.copy(image, copyStartX, copyStartY, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);



    /***********IMAGE MANIPULATION GOES HERE**********/


    // THE MAIN EFFECT STACK SWITCH

    switch(effects_stack_type) {

      case 0: // Monochrome dither
        animateMonochromeDither(referenceGraphic, image_border, animation_name, sketch);
        break;

      case 1: // Tinted dither
        await animateTintedDither(referenceGraphic, image_border, animation_name, sketch);
        break;

      case 2: // Color dither + pixel sorting
        animateDitherSorting(referenceGraphic, image_border, animation_name, sketch);
        break;

      case 3: // Pixel sorting + color dither
        animateSortingDither(referenceGraphic, image_border, animation_name, sketch);
        break;

      case 4: // Abstract dither
        animateAbstractDither(referenceGraphic, image_border, animation_name, sketch);
        break;

      default:
        break;

      }

    /***********IMAGE MANIPULATION ENDS HERE**********/




    /* HELPFUL DEBUG CODE
      -Display original source image in top right,
      -Used to compare the original with added effects.
      -Comment this out before production.
    */
    // sk.copy(G["ref"], 0, 0, DIM, DIM, DIM - DIM / 5, 0, DIM / 5, DIM / 5,);


    //Saves the image for test review: Remove from production
    //sketch.saveCanvas(sketch, "" + Math.floor(Math.random() * 10000), 'png');



    //Times how long the image takes to run
    console.log("---Processing Complete---");
    console.log("Time: " + (Date.now() - startmilli) / 1000 + " seconds");
    royalties = {
      "decimals": 3,
    }
    calculateRoyalties(royalties, royalty_tally);
    return sketch.getCanvasDataURL(sketch);
  } catch (e) {
    console.error(e);
  }
}
