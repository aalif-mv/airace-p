function randInt(min = 0, max = 10) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function seedBasedRandom() {
  // 
}
function dp2(num){
  return Math.round((num + Number.EPSILON) * 100) / 100
}