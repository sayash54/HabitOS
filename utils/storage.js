export function getHabits(){
    const stored = localStorage.getItem("habits");
    return JSON.parse(stored) || [
        { id: 1, name: "Read Book", done: false },
        { id: 2, name: "Learn Python", done: false },
        { id: 3, name: "Wake up at 6", done: false },
        { id: 4, name: "Workout", done: false }
    ];
}

export function saveHabits(data){
    localStorage.setItem("habits", JSON.stringify(data));
}