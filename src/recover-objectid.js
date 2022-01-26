'use strict';

module.exports = function(mongoose, cachedResults) {
  if (Array.isArray(cachedResults)) {
    const l = cachedResults.length;
    for (let i = 0; i < l; i++) {
      cachedResults[i] = recoverObjectId(mongoose)(cachedResults[i]);
    }
  }
  return recoverObjectId(mongoose)(cachedResults);
};

function recoverObjectId(mongoose) {
  return (data) => {
    const { ObjectId } = mongoose.Types;
    const { _id } = data;

    const isValidObjectId = ObjectId.isValid(_id) && new ObjectId(_id).toString() === _id;
    if (!isValidObjectId) {
      return data;
    }

    data._id = new ObjectId(_id);
    return data;
  };
}
