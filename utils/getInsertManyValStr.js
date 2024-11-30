const getValueFormat = function (qntColunm, index) {
  let valueFormat = '(';
  const start = qntColunm * index + 1;
  const end = start + qntColunm;
  for (let i = start; i < end; i++) {
    valueFormat += `$${i},`;
    if (i === end - 1) valueFormat = valueFormat.slice(0, -1) + ')';
  }
  return valueFormat;
};

module.exports = (qntRows, qntColunm) => {
  let finalStr = '';
  for (let i = 0; i < qntRows; i++) {
    finalStr += getValueFormat(qntColunm, i) + ',';
    if (i === qntRows - 1) finalStr = finalStr.slice(0, -1);
  }
  return finalStr;
};
