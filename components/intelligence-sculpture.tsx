/** A kinetic paper mobile, drawn as a small decorative print. */
export function IntelligenceSculpture() {
  return (
    <div className="intelligence-sculpture" aria-hidden="true">
      <svg viewBox="0 0 300 250" fill="none">
        <ellipse cx="155" cy="226" rx="88" ry="8" fill="#77764B" opacity=".07" />
        <path d="M42 218h216M53 212V40h192v172" stroke="#B6AF98" strokeWidth=".6" />
        <g className="print-mobile">
          <path d="M160 30v25m-78 12 153-22M91 66v49m137-69v99" stroke="#74775F" strokeWidth="1.2" />
          <circle cx="91" cy="136" r="23" fill="#B45C3D" />
          <path d="M91 113v46M68 136h46" stroke="#F6F3EC" strokeWidth=".6" opacity=".6" />
          <path d="M201 154a27 27 0 0 1 54 0v24h-54v-24Z" fill="#858B64" />
          <path d="M208 178v-24a20 20 0 0 1 40 0v24m-33 0v-24a13 13 0 0 1 26 0v24" stroke="#F6F3EC" strokeWidth=".7" opacity=".7" />
          <path d="M157 57v113" stroke="#74775F" strokeWidth="1.2" />
          <g className="print-sun">
            <circle cx="160" cy="125" r="44" stroke="#BFAA80" strokeWidth=".8" />
            <circle cx="160" cy="125" r="36" stroke="#BFAA80" strokeWidth=".6" />
            <path d="M160 75v100m-50-50h100m-85-35 70 70m0-70-70 70" stroke="#BFAA80" strokeWidth=".65" />
            <circle cx="160" cy="125" r="13" fill="#CCAB6F" />
          </g>
          <g className="print-leaf"><path d="M155 180c-40-35-72-17-57 8 14 25 49 20 57-8Z" fill="#737B58" /><path d="M155 180c40-30 64-4 44 17-20 17-39 1-44-17Z" fill="#C99070" /><path d="m103 177 94 14" stroke="#F6F3EC" strokeWidth=".7" /></g>
        </g>
        <path d="M34 31h9m-4-4v9m216 162h9m-4-4v9" stroke="#9A9074" strokeWidth=".75" />
      </svg>
    </div>
  )
}
